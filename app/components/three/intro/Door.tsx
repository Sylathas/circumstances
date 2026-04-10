"use client"

/**
 * Door renders the animated key, keyhole, and door geometry for the intro sequence.
 * It manages phase transitions and notifies an optional onPhaseChange callback when the phase changes.
 * Used exclusively inside IntroScene on the home page.
 */

import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import Key from './Key'
import KeyClone from './KeyClone'
import { ANIMATION_CONFIG } from '@/app/config/animation'
import { useIsMobile } from '@/app/hooks/useIsMobile'

type Phase = 'following' | 'rotating' | 'door'

function KeyHole({ setPhase, position, groupRef, whiteMaterial }: {
    setPhase: (phase: Phase) => void,
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

    const blockPointer = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
    }

    function onUnlock() {
        setPhase('rotating')
    }

    return (<group onClick={(e) => { e.stopPropagation(); onUnlock?.() }} onPointerDown={blockPointer} onPointerMove={blockPointer}>
        <primitive object={scene} scale={1} position={position} rotation={[0, Math.PI, 0]} ref={groupRef} />
    </group>
    )
}

type DoorProps = {
    onPhaseChange?: (phase: Phase) => void
    onDoorOpened?: () => void
}

export default function Door({ onPhaseChange, onDoorOpened }: DoorProps) {
    const isMobile = useIsMobile()
    const [phase, setPhase] = useState<Phase>('following')
    const [capturedTransform, setCapturedTransform] = useState<THREE.Matrix4 | null>(null)
    const width = ANIMATION_CONFIG.introDoor.doorWidth;
    const DOOR_TARGET_ROT = Math.PI / 1.4
    const doorRef = useRef<THREE.Group | null>(null)
    const keyholeRef = useRef<THREE.Group | null>(null)
    const openedNotifiedRef = useRef(false)
    const whiteMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffffff }), [])
    const blockPointer = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
    }

    const setPhaseAndNotify = (next: Phase) => {
        setPhase(next)
        onPhaseChange?.(next)
    }

    useFrame(() => {
        if (phase !== 'door') return
        if (!doorRef.current || !capturedTransform) return
        doorRef.current.rotation.y = THREE.MathUtils.lerp(
            doorRef.current.rotation.y,
            DOOR_TARGET_ROT,
            ANIMATION_CONFIG.introDoor.rotateLerp
        )
        if (!openedNotifiedRef.current && Math.abs(doorRef.current.rotation.y - DOOR_TARGET_ROT) < 0.03) {
            openedNotifiedRef.current = true
            onDoorOpened?.()
        }
    })

    return (
        <>
            <group position={[-width / 2, 0, 0]} ref={doorRef}>
                <KeyHole setPhase={setPhaseAndNotify} position={[width / 2, 0, -5]} groupRef={keyholeRef} whiteMaterial={whiteMaterial} />
                {phase === 'door' && (
                    <KeyClone position={[width / 2, 0, -5]} capturedTransform={capturedTransform} whiteMaterial={whiteMaterial} />
                )}
                <mesh position={[width / 2, 0, -5]} onPointerDown={blockPointer} onPointerMove={blockPointer}>
                    <boxGeometry args={[width, 50, 0.2]} />
                    <meshBasicMaterial color="black" />
                </mesh>
            </group>
            {phase !== 'door' && (
                <Key
                    phase={phase}
                    setPhase={setPhaseAndNotify}
                    setCapturedTransform={setCapturedTransform}
                    whiteMaterial={whiteMaterial}
                    isMobileMode={isMobile}
                />
            )}
        </>
    )
}