"use client"

import dynamic from 'next/dynamic'
import { Stats } from '@react-three/drei'

const Scene = dynamic(() => import('../Scene'), { ssr: false })

export default function SceneWrapper() {
    return (
        <>
            <Scene />
            <Stats showPanel={0} className="stats" />
        </>
    )
}