"use client"

import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import React, { useRef, useEffect, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'


export default function Key({ phase, setPhase, setCapturedTransform, whiteMaterial }: {
    phase: 'following' | 'rotating' | 'door',
    setPhase: (phase: 'following' | 'rotating' | 'door') => void,
    setCapturedTransform: (transform: THREE.Matrix4 | null) => void
    whiteMaterial: THREE.MeshBasicMaterial
}) {
    const meshRef = useRef<THREE.Mesh>(null)
    const KEYHOLE_POSITION = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, -10))
    const raycaster = useRef<THREE.Raycaster>(new THREE.Raycaster())
    const plane = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0))
    const targetPosition = useRef<THREE.Vector3>(new THREE.Vector3())
    const currentRotationY = useRef<number | null>(null)

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
        meshRef.current.layers.set(1)
        window.addEventListener('mousemove', handleMouseMove)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
        }
    }, [])

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
            if (currentRotationY.current === null) {
                currentRotationY.current = meshRef.current.rotation.y
            }
            const target = currentRotationY.current + Math.PI / 2
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