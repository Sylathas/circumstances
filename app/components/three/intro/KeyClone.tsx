import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useMemo, useRef, useEffect } from 'react'

export default function KeyClone({ position, capturedTransform, whiteMaterial }: {
    position: [number, number, number],
    capturedTransform: THREE.Matrix4 | null
    whiteMaterial: THREE.MeshBasicMaterial
}) {
    const { scene } = useGLTF('/models/Circumstances_Website_KeyC.glb')
    const cloneRef = useRef<THREE.Group | null>(null)

    const clonedScene = useMemo(() => {
        const clone = scene.clone(true)
        clone.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.material = whiteMaterial
            }
        })
        return clone
    }, [scene, whiteMaterial])

    useEffect(() => {
        if (!cloneRef.current || !capturedTransform) return

        //Convert capturedTransform to local space of the door group
        const parent = cloneRef.current.parent
        if (!parent) return
        parent.updateWorldMatrix(true, false)
        const keyWorldMatrix = capturedTransform
        const parentInverse = parent.matrixWorld.clone().invert()
        const localMatrix = keyWorldMatrix.clone().premultiply(parentInverse)
        cloneRef.current.matrix.copy(localMatrix)
        cloneRef.current.matrix.decompose(
            cloneRef.current.position,
            cloneRef.current.quaternion,
            cloneRef.current.scale
        )
    }, [capturedTransform])

    return <primitive object={clonedScene} position={position} ref={cloneRef} />
}