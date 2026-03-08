"use client"

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import Door from './intro/Door'

import {
    EffectComposer,
    ToneMapping,
    Vignette,
    Noise,
    HueSaturation,
} from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

function CameraEffects() {
    return (
        <EffectComposer multisampling={8}>
            {/* Exposure / tone mapping — like camera ISO + film stock */}
            <ToneMapping
                mode={ToneMappingMode.ACES_FILMIC}  // cinematic look
                // other options: REINHARD, CINEON, LINEAR
                middleGrey={0.6}        // exposure midpoint
                maxLuminance={16.0}
                averageLuminance={1.0}
            />

            {/* Vignette — darkened edges like a lens */}
            <Vignette
                offset={0.3}       // how far from center it starts
                darkness={0.8}     // how dark the edges get
            />

            {/* Film grain */}
            <Noise opacity={0.03} />

            {/* Hue / saturation */}
            <HueSaturation
                hue={0}
                saturation={0.1}
            />

        </EffectComposer>
    )
}

export default function Scene() {

    return (
        <>
            <video autoPlay muted loop id="myVideo">
                <source src="/textures/BG-fx.mp4" type="video/mp4"></source>
            </video>
            <Canvas camera={{ fov: 30, position: [0, 0, 22] }} gl={{ alpha: true }} onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}>
                <Suspense fallback={null}>
                    <Door />
                    <CameraEffects />
                </Suspense>
            </Canvas >
        </>
    )
}