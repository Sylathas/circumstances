"use client"

/**
 * Key renders and animates the 3D key that follows the cursor and unlocks the Door.
 * It receives the current phase, a phase setter, and a transform callback to sync with the cloned key.
 * Used solely inside Door as part of the intro animation.
 */

import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import React, { useRef, useEffect, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

const KEY_APPROACH_MS = 500;
const KEY_ROTATE_MS = 1000;

function easeInOutCubic(t: number): number {
    if (t < 0.5) return 4 * t * t * t;
    return 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function Key({ phase, setPhase, setCapturedTransform, whiteMaterial, isMobileMode }: {
    phase: 'following' | 'rotating' | 'door',
    setPhase: (phase: 'following' | 'rotating' | 'door') => void,
    setCapturedTransform: (transform: THREE.Matrix4 | null) => void
    whiteMaterial: THREE.MeshBasicMaterial
    isMobileMode: boolean
}) {
    const meshRef = useRef<THREE.Mesh>(null)
    // Must match Door keyhole world depth (z ~ -5). If this is too far back,
    // the key disappears behind the door plane during rotating phase.
    const KEYHOLE_POSITION = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, -10))
    const KEYHOLE_APPROACH_POSITION = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, -5))
    // Keep mobile approach in front of the door plane (z ~ -5) so the key
    // does not get occluded/disappear while traveling from the right.
    const MOBILE_APPROACH_POSITION = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, -4.7))
    const MOBILE_SPAWN_POSITION = useRef<THREE.Vector3>(new THREE.Vector3(8, -2, 0))
    const raycaster = useRef<THREE.Raycaster>(new THREE.Raycaster())
    const plane = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0))
    const targetPosition = useRef<THREE.Vector3>(new THREE.Vector3())
    const mobileSpawnedRef = useRef(false)
    const approachStartPosRef = useRef<THREE.Vector3 | null>(null)
    const approachStartMsRef = useRef<number | null>(null)
    const approachDoneRef = useRef(false)
    const turnStartQuatRef = useRef<THREE.Quaternion | null>(null)
    const turnTargetQuatRef = useRef<THREE.Quaternion | null>(null)
    const turnStartMsRef = useRef<number | null>(null)
    const turnStartYRef = useRef<number | null>(null)
    const turnTargetYRef = useRef<number | null>(null)

    const { scene } = useGLTF('/models/Circumstances_Website_KeyC.glb')
    const camera = useThree()

    const mouseRef = useRef(new THREE.Vector2(0, 0))

    const handleMouseMove = useCallback((e: MouseEvent) => {
        mouseRef.current.set(
            (e.clientX / window.innerWidth) * 2 - 1,
            -(e.clientY / window.innerHeight) * 2 + 1
        )
    }, [])

    useEffect(() => {
        if (!meshRef.current) return
        if (isMobileMode) {
            meshRef.current.visible = false
            meshRef.current.position.copy(MOBILE_SPAWN_POSITION.current)
            return
        }
        meshRef.current.visible = true
        window.addEventListener('mousemove', handleMouseMove)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
        }
    }, [handleMouseMove, isMobileMode])

    //Change Material to White
    useEffect(() => {
        scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.material = whiteMaterial
            }
        })
    }, [scene, whiteMaterial])

    useFrame(() => {
        if (!meshRef.current) return
        const now = performance.now()

        if (phase === 'following') {
            mobileSpawnedRef.current = false
            approachStartPosRef.current = null
            approachStartMsRef.current = null
            approachDoneRef.current = false
            turnStartQuatRef.current = null
            turnTargetQuatRef.current = null
            turnStartMsRef.current = null
            turnStartYRef.current = null
            turnTargetYRef.current = null
            if (isMobileMode) {
                meshRef.current.visible = false
                return
            }
            meshRef.current.visible = true
            raycaster.current.setFromCamera(mouseRef.current, camera.camera)
            raycaster.current.ray.intersectPlane(plane.current, targetPosition.current)

            if (targetPosition) {
                //lerp toward target (e.g. 0.12)
                meshRef.current.position.lerp(targetPosition.current, 0.1)

                // Always point at keyhole
                meshRef.current.lookAt(KEYHOLE_POSITION.current)
                meshRef.current.rotateX(Math.PI / 2)
                meshRef.current.rotateY(Math.PI / 2)

                // Y rotation as key gets closer: 0 when far, -Math.PI/2 when on keyhole
                const dx = meshRef.current.position.x - KEYHOLE_POSITION.current.x
                const dy = meshRef.current.position.y - KEYHOLE_POSITION.current.y
                const d = Math.sqrt(dx * dx + dy * dy)
                const radius = 5  // distance at which rotation is “full”
                const t = 1 - Math.min(1, d / radius)  // 0 far, 1 at keyhole
                const extraY = Math.PI / 100
                meshRef.current.rotateY(extraY)
                meshRef.current.scale.setScalar(t * .8 + 0.5) //make bigger as it gets closer
                //Make key go inside keyhole when hovering it
                const targetZ = t > 0.96 ? KEYHOLE_POSITION.current.z : 0
                meshRef.current.position.z = THREE.MathUtils.lerp(
                    meshRef.current.position.z,
                    targetZ - 3,
                    .05
                )
            }
        } else if (phase === 'rotating') {
            meshRef.current.visible = true
            if (isMobileMode) {
                if (!mobileSpawnedRef.current) {
                    meshRef.current.position.copy(MOBILE_SPAWN_POSITION.current)
                    meshRef.current.lookAt(KEYHOLE_POSITION.current)
                    meshRef.current.rotateX(Math.PI / 2)
                    meshRef.current.rotateY(Math.PI / 2)
                    mobileSpawnedRef.current = true
                    approachStartPosRef.current = meshRef.current.position.clone()
                    approachStartMsRef.current = now
                    approachDoneRef.current = false
                    turnStartQuatRef.current = null
                    turnTargetQuatRef.current = null
                    turnStartMsRef.current = null
                }
                if (!approachDoneRef.current) {
                    const approachStart = approachStartPosRef.current ?? meshRef.current.position
                    const approachT = Math.min(1, Math.max(0, (now - (approachStartMsRef.current ?? now)) / KEY_APPROACH_MS))
                    const approachEase = easeInOutCubic(approachT)
                    meshRef.current.position.lerpVectors(approachStart, MOBILE_APPROACH_POSITION.current, approachEase)
                    if (approachT < 1) {
                        meshRef.current.lookAt(KEYHOLE_POSITION.current)
                        meshRef.current.rotateX(Math.PI / 2)
                        meshRef.current.rotateY(Math.PI / 2)
                        return
                    }
                    approachDoneRef.current = true
                }
                if (turnStartQuatRef.current === null || turnTargetQuatRef.current === null) {
                    turnStartQuatRef.current = meshRef.current.quaternion.clone()
                    // Build a stable local-space turn target to avoid Euler axis flips.
                    const turnQuat = new THREE.Quaternion().setFromAxisAngle(
                        new THREE.Vector3(0, 1, 0),
                        -Math.PI / 2
                    )
                    turnTargetQuatRef.current = turnStartQuatRef.current.clone().multiply(turnQuat)
                    turnStartMsRef.current = now
                }
                const turnT = Math.min(1, Math.max(0, (now - (turnStartMsRef.current ?? now)) / KEY_ROTATE_MS))
                const turnEase = easeInOutCubic(turnT)
                meshRef.current.quaternion.slerpQuaternions(
                    turnStartQuatRef.current,
                    turnTargetQuatRef.current,
                    turnEase
                )
                if (turnT >= 1) {
                    setCapturedTransform(meshRef.current.matrixWorld.clone())
                    setPhase('door')
                }
                return
            } else {
                const approachTarget = KEYHOLE_APPROACH_POSITION.current
                if (!approachDoneRef.current) {
                    if (approachStartPosRef.current === null) {
                        approachStartPosRef.current = meshRef.current.position.clone()
                        approachStartMsRef.current = now
                    }
                    const approachT = Math.min(1, Math.max(0, (now - (approachStartMsRef.current ?? now)) / KEY_APPROACH_MS))
                    const approachEase = easeInOutCubic(approachT)
                    meshRef.current.position.lerpVectors(
                        approachStartPosRef.current,
                        approachTarget,
                        approachEase
                    )
                    if (approachT < 1) return
                    approachDoneRef.current = true
                }
            }
            if (turnStartYRef.current === null || turnTargetYRef.current === null) {
                turnStartYRef.current = meshRef.current.rotation.y
                turnTargetYRef.current = turnStartYRef.current + Math.PI / 2
                turnStartMsRef.current = now
            }
            const turnT = Math.min(1, Math.max(0, (now - (turnStartMsRef.current ?? now)) / KEY_ROTATE_MS))
            const turnEase = easeInOutCubic(turnT)
            meshRef.current.rotation.y = THREE.MathUtils.lerp(
                turnStartYRef.current,
                turnTargetYRef.current,
                turnEase
            )
            if (turnT >= 1) {
                setCapturedTransform(meshRef.current.matrixWorld.clone())
                setPhase('door')
            }
        }
    })

    return (<mesh ref={meshRef}>
        <primitive object={scene} scale={1} position={[0, 0, 0]} />
        <meshBasicMaterial color={'white'} />
    </mesh>)
}