"use client"

/**
 * IntroScene renders the 3D door intro sequence inside a Canvas.
 * It accepts an onIntroComplete callback that fires when the door reaches its final phase.
 * Used on the home page to gate the main menu behind the animated door.
 */

import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import dynamic from 'next/dynamic'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import Door from './intro/Door'
import * as THREE from 'three'
import KeychainModels from '@/app/components/keychain/KeychainModels'
import { VideoBacklight } from '@/app/components/keychain/VideoBacklight'
import { useIsMobile } from "@/app/hooks/useIsMobile";

import {
    EffectComposer,
    Bloom,
    Vignette,
    Noise,
    HueSaturation,
} from '@react-three/postprocessing'
import { ANIMATION_CONFIG } from '@/app/config/animation'
import { useDeviceTier } from '@/app/context/DeviceTierContext'
import { DeviceTier } from '@/app/config/deviceTier'

// Dev-only: leva post-processing editor. Tree-shaken from production builds.
const PostFxEditor = process.env.NODE_ENV === 'development'
    ? dynamic(() => import('@/app/components/dev/PostFxEditor').then(m => ({ default: m.PostFxEditor })), { ssr: false })
    : null

type IntroSceneProps = {
    mode: "intro" | "menu-only"
    onIntroComplete: () => void
    onKeyholeInserted?: () => void
    onSceneReady?: () => void
    onIntroReady?: () => void
    videoRef: RefObject<HTMLVideoElement | null>
}

type DevEditorValues = {
    fx: FxValues;
    emissiveIntensity: number;
}

export type FxValues = typeof ANIMATION_CONFIG.scenePostFx;

type CameraEffectsProps = {
    fxValues?: FxValues;
    /** 0 = no bloom; 1 = full `scenePostFx.bloomIntensity`. Ramps during door open on intro. */
    bloomIntensityScale?: number;
};

/** Wrapper so EffectComposer never receives `false` as a child (its types require ReactElement). */
function BloomEffect({ fx, intensityScale, tier }: { fx: FxValues; intensityScale: number; tier: DeviceTier }) {
    return (
        <Bloom
            intensity={tier === "mobile" ? fx.mobileBloomIntensity * intensityScale : fx.bloomIntensity * intensityScale}
            luminanceThreshold={fx.bloomLuminanceThreshold}
            luminanceSmoothing={fx.bloomLuminanceSmoothing}
            radius={fx.bloomRadius}
            mipmapBlur={false}
        />
    )
}

function CameraEffects({ fxValues, bloomIntensityScale = 1 }: CameraEffectsProps) {
    const { tier, fxMatrix } = useDeviceTier()
    const tierFx = fxMatrix[tier]
    const fx = fxValues ?? ANIMATION_CONFIG.scenePostFx
    const useBloom = tierFx.bloom && bloomIntensityScale > 0.001

    if (!tierFx.postProcessing) return null
    const ms = tier === "tablet" ? 4 : 8

    if (!useBloom) {
        return (
            <EffectComposer multisampling={ms}>
                <Vignette offset={fx.vignetteOffset} darkness={fx.vignetteDarkness} />
                <Noise opacity={fx.noiseOpacity} />
                <HueSaturation hue={0} saturation={fx.saturation} />
            </EffectComposer>
        )
    }

    return (
        <EffectComposer multisampling={ms}>
            <BloomEffect fx={fx} intensityScale={bloomIntensityScale} tier={tier} />
            <Vignette offset={fx.vignetteOffset} darkness={fx.vignetteDarkness} />
            <Noise opacity={tier === "mobile" ? fx.mobileNoiseOpacity : fx.noiseOpacity} />
            <HueSaturation hue={0} saturation={fx.saturation} />
        </EffectComposer>
    )
}

const INTRO_LOOK_AT = new THREE.Vector3(0, 0, -5)
const KEYCHAIN_LOOK_AT = new THREE.Vector3(0, 0, 0)
const KEYCHAIN_CAMERA_POS = new THREE.Vector3(0, 0, ANIMATION_CONFIG.introScene.cameraZ)
const INTRO_CAMERA_POS = new THREE.Vector3(0, 0, ANIMATION_CONFIG.introScene.cameraZ)
const KEYCHAIN_WORLD_POS = new THREE.Vector3(0, 0, -30)
const KEYCHAIN_WORLD_SCALE = 4
const KEYCHAIN_MOBILE_WORLD_SCALE = 3.5

type MobileKeychainZoomTargetRef = RefObject<number>

type ZoomSegmentState = {
    display: number
    segmentFrom: number
    segmentTo: number
    segmentStartMs: number
    committedTarget: number
}

function smoothstep01(t: number): number {
    const x = THREE.MathUtils.clamp(t, 0, 1)
    return x * x * (3 - 2 * x)
}

function UnifiedCameraRig({
    revealKeychain,
    mobileKeychainZoomTargetRef,
    isMobileViewport,
}: {
    revealKeychain: boolean
    mobileKeychainZoomTargetRef: MobileKeychainZoomTargetRef
    isMobileViewport: boolean
}) {
    const { camera } = useThree()
    const lookAtTarget = useMemo(() => new THREE.Vector3(), [])
    const zoomSegRef = useRef<ZoomSegmentState>({
        display: 0,
        segmentFrom: 0,
        segmentTo: 0,
        segmentStartMs: 0,
        committedTarget: 0,
    })

    useFrame(() => {
        const zoomCfg = ANIMATION_CONFIG.introScene.mobileKeychainZoom
        const zst = zoomSegRef.current
        const useMobileZoom =
            revealKeychain && isMobileViewport

        if (!useMobileZoom) {
            zst.display = 0
            zst.segmentFrom = 0
            zst.segmentTo = 0
            zst.segmentStartMs = 0
            zst.committedTarget = 0
            mobileKeychainZoomTargetRef.current = 0
        } else {
            const want = mobileKeychainZoomTargetRef.current
            if (want !== zst.committedTarget) {
                zst.segmentFrom = zst.display
                zst.segmentTo = want
                zst.segmentStartMs = performance.now()
                zst.committedTarget = want
            }
            const elapsed = performance.now() - zst.segmentStartMs
            const u = zoomCfg.durationMs > 0 ? Math.min(1, elapsed / zoomCfg.durationMs) : 1
            zst.display = zst.segmentFrom + (zst.segmentTo - zst.segmentFrom) * smoothstep01(u)
        }

        const baseTarget = revealKeychain ? KEYCHAIN_CAMERA_POS : INTRO_CAMERA_POS
        const targetPos = baseTarget.clone()
        if (useMobileZoom) {
            targetPos.z -= zoomCfg.closenessZ * zst.display
        }

        const targetLook = revealKeychain ? KEYCHAIN_LOOK_AT : INTRO_LOOK_AT
        const posAlpha = revealKeychain ? 0.06 : 0.2
        const lookAlpha = revealKeychain ? 0.08 : 0.2

        const posDeltaSq = camera.position.distanceToSquared(targetPos)
        const lookDeltaSq = lookAtTarget.distanceToSquared(targetLook)
        if (posDeltaSq < 1e-8 && lookDeltaSq < 1e-8) return

        if (posDeltaSq >= 1e-8) camera.position.lerp(targetPos, posAlpha)
        if (lookDeltaSq >= 1e-8) lookAtTarget.lerp(targetLook, lookAlpha)
        camera.lookAt(lookAtTarget)
    })

    return null
}

function SuspenseReady({ onReady }: { onReady?: () => void }) {
    useEffect(() => {
        onReady?.()
    }, [onReady])
    return null
}

export default function IntroScene({ mode, onIntroComplete, onKeyholeInserted, onSceneReady, onIntroReady, videoRef }: IntroSceneProps) {
    const { tier, fxMatrix } = useDeviceTier()
    const startInKeychain = mode === "menu-only"
    const [revealKeychain, setRevealKeychain] = useState(startInKeychain)
    const [doorOpened, setDoorOpened] = useState(startInKeychain)
    const [doorBloomEased, setDoorBloomEased] = useState(startInKeychain ? 1 : 0)
    const [devEditorValues, setDevEditorValues] = useState<DevEditorValues | null>(null)
    const introZ = ANIMATION_CONFIG.introScene.cameraZ
    const phaseNotifiedRef = useRef(false)
    const isMobile = useIsMobile()
    const mobileKeychainZoomTargetRef = useRef(0)

    const keychainWorldScale = isMobile ? KEYCHAIN_MOBILE_WORLD_SCALE : KEYCHAIN_WORLD_SCALE

    return (
        <>
            {PostFxEditor && <PostFxEditor onValuesChange={setDevEditorValues} />}
            <Canvas
                camera={{
                    fov: ANIMATION_CONFIG.introScene.cameraFov,
                    position: [0, 0, introZ],
                }}
                dpr={[1, fxMatrix[tier].maxDpr]}
                gl={{ alpha: true }}
                onCreated={({ gl }) => {
                    gl.setClearColor(0x000000, 0)
                    onSceneReady?.()
                }}
                style={{ width: '100vw', height: '100vh' }}
            >
                <Suspense fallback={null}>
                    <SuspenseReady onReady={onIntroReady} />
                    <UnifiedCameraRig
                        revealKeychain={revealKeychain}
                        mobileKeychainZoomTargetRef={mobileKeychainZoomTargetRef}
                        isMobileViewport={isMobile}
                    />
                    {!startInKeychain && !doorOpened && (
                        <Door
                            onDoorBloomProgress={setDoorBloomEased}
                            onPhaseChange={(phase) => {
                                if (phase === 'rotating') {
                                    onKeyholeInserted?.()
                                    setRevealKeychain(true)
                                }
                            }}
                            onDoorOpened={() => {
                                if (phaseNotifiedRef.current) return
                                phaseNotifiedRef.current = true
                                setDoorBloomEased(1)
                                setDoorOpened(true)
                                onIntroComplete()
                            }}
                        />
                    )}
                    <VideoBacklight
                        videoRef={videoRef}
                        emissiveIntensity={devEditorValues?.emissiveIntensity ?? 1.5}
                    />
                    <group position={KEYCHAIN_WORLD_POS} scale={keychainWorldScale}>
                        <KeychainModels
                            visible={revealKeychain}
                            interactive={startInKeychain || revealKeychain}
                            mobileKeychainZoomTargetRef={mobileKeychainZoomTargetRef}
                            isMobileViewport={isMobile}
                        />
                    </group>
                    <CameraEffects
                        fxValues={devEditorValues?.fx ?? ANIMATION_CONFIG.scenePostFx}
                        bloomIntensityScale={startInKeychain ? 1 : doorOpened ? 1 : doorBloomEased}
                    />
                </Suspense>
            </Canvas>
        </>
    )
}