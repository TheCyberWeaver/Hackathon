import { useMemo } from 'react'
import { BarcodeFormat, QRCodeWriter } from '@zxing/library'

export default function JoinQrCode({ url }: { url: string }) {
  const { path, size } = useMemo(() => {
    const matrix = new QRCodeWriter().encode(
      url,
      BarcodeFormat.QR_CODE,
      256,
      256,
      new Map(),
    )
    const parts: string[] = []
    for (let y = 0; y < matrix.getHeight(); y++) {
      for (let x = 0; x < matrix.getWidth(); x++) {
        if (matrix.get(x, y)) parts.push(`M${x} ${y}h1v1h-1z`)
      }
    }
    return { path: parts.join(''), size: matrix.getWidth() }
  }, [url])

  return (
    <svg
      role="img"
      aria-label="QR code for the student join link"
      viewBox={`0 0 ${size} ${size}`}
      className="aspect-square w-full max-w-64"
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="white" />
      <path d={path} fill="#0f172a" />
    </svg>
  )
}
