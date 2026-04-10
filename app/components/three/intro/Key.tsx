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
    const currentRotationY = useRef<number | null>(null)
    const mobileSpawnedRef = useRef(false)
    const mobileTurnTargetQuat = useRef<THREE.Quaternion | null>(null)

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

        if (phase === 'following') {
            mobileSpawnedRef.current = false
            currentRotationY.current = null
            mobileTurnTargetQuat.current = null
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
                    currentRotationY.current = null
                    mobileTurnTargetQuat.current = null
                }
                const arrived = meshRef.current.position.distanceTo(MOBILE_APPROACH_POSITION.current) < 0.2
                if (!arrived) {
                    meshRef.current.position.lerp(MOBILE_APPROACH_POSITION.current, 0.05)
                    meshRef.current.lookAt(KEYHOLE_POSITION.current)
                    meshRef.current.rotateX(Math.PI / 2)
                    meshRef.current.rotateY(Math.PI / 2)
                    return
                }
                if (mobileTurnTargetQuat.current === null) {
                    const startQuat = meshRef.current.quaternion.clone()
                    // Build a stable local-space turn target to avoid Euler axis flips.
                    const turnQuat = new THREE.Quaternion().setFromAxisAngle(
                        new THREE.Vector3(0, 1, 0),
                        -Math.PI / 2
                    )
                    mobileTurnTargetQuat.current = startQuat.multiply(turnQuat)
                }
                meshRef.current.quaternion.slerp(mobileTurnTargetQuat.current, 0.08)
                if (meshRef.current.quaternion.angleTo(mobileTurnTargetQuat.current) < 0.02) {
                    setCapturedTransform(meshRef.current.matrixWorld.clone())
                    setPhase('door')
                }
                return
            } else {
                const approachTarget = KEYHOLE_APPROACH_POSITION.current
                meshRef.current.position.lerp(approachTarget, 0.12)
                const approachDone = meshRef.current.position.distanceTo(approachTarget) < 0.25
                if (!approachDone) return
            }
            if (currentRotationY.current === null) {
                currentRotationY.current = meshRef.current.rotation.y
            }

            let target = currentRotationY.current + Math.PI / 2

            meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, target, 0.05)
            if (Math.abs(meshRef.current.rotation.y - target) < 0.01) {
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