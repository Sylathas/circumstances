"use client"

import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import Key from './Key'
import KeyClone from './KeyClone'

function KeyHole({ setPhase, position, groupRef, whiteMaterial }: {
    setPhase: (phase: 'following' | 'rotating' | 'door') => void,
    position: [number, number, number]
    groupRef: React.RefObject<THREE.Group | null>
    whiteMaterial: THREE.MeshBasicMaterial
}) {
    const { scene } = useGLTF('/models/Circumstances_Website_Keyhole.glb')

    //Change Material to White
    useEffect(() => {
        scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.material = whiteMaterial
            }
        })
    }, [scene, whiteMaterial])

    function onUnlock() {
        setPhase('rotating')
        console.log('unlocked')
    }

    return (<group onClick={(e) => { e.stopPropagation(); onUnlock?.() }} >
        <primitive object={scene} scale={1} position={position} rotation={[0, Math.PI, 0]} ref={groupRef} />
    </group>
    )
}

export default function Door() {
    const [phase, setPhase] = useState<'following' | 'rotating' | 'door'>('following')
    const [capturedTransform, setCapturedTransform] = useState<THREE.Matrix4 | null>(null)
    const width = 30;
    const doorRef = useRef<THREE.Group | null>(null)
    const keyholeRef = useRef<THREE.Group | null>(null)
    const whiteMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffffff }), [])

    useFrame(() => {
        if (phase !== 'door') return
        if (!doorRef.current || !capturedTransform) return
        doorRef.current.rotation.y = THREE.MathUtils.lerp(doorRef.current.rotation.y, Math.PI / 1.4, 0.01)
    })

    return (
        <>
            <group position={[-width / 2, 0, 0]} ref={doorRef}>
                <KeyHole setPhase={setPhase} position={[width / 2, 0, -5]} groupRef={keyholeRef} whiteMaterial={whiteMaterial} />
                {phase === 'door' && (
                    <KeyClone position={[width / 2, 0, -5]} capturedTransform={capturedTransform} whiteMaterial={whiteMaterial} />
                )}
                <mesh position={[width / 2, 0, -5]}>
                    <boxGeometry args={[width, 50, 0.2]} />
                    <meshBasicMaterial color="black" />
                </mesh>
            </group>
            {phase !== 'door' && (
                <Key phase={phase} setPhase={setPhase} setCapturedTransform={setCapturedTransform} whiteMaterial={whiteMaterial} />
            )}
        </>
    )
}