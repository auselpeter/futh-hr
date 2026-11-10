'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Camera, Upload, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type Props = {
  type?: string
  accept?: string
  label?: string
  value?: string | null
  // onChange is called with the URL after a successful upload.
  // Optionally also receives the original fileName, fileSize (bytes), and mimeType
  // when the caller needs the metadata (e.g. the Documents page).
  onChange: (url: string, fileName?: string, fileSize?: number, mimeType?: string) => void
  allowCamera?: boolean
  className?: string
  previewClassName?: string
}

export default function FileUpload({
  type = 'general',
  accept = 'image/*',
  label = 'Upload file',
  value,
  onChange,
  allowCamera = false,
  className = '',
  previewClassName = 'size-24',
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)
      const res = await fetch('/api/uploads', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      onChange(data.url, data.fileName, data.fileSize, data.mimeType)
      toast.success('File uploaded')
    } catch (e: any) {
      toast.error(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [type, onChange])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  const openCamera = async () => {
    setCameraOpen(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (e) {
      toast.error('Camera not available. Use file upload instead.')
      setCameraOpen(false)
    }
  }

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOpen(false)
  }

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return
    const v = videoRef.current
    const c = canvasRef.current
    c.width = v.videoWidth || 320
    c.height = v.videoHeight || 240
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.drawImage(v, 0, 0, c.width, c.height)
    c.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
        uploadFile(file)
      }
      closeCamera()
    }, 'image/jpeg', 0.85)
  }

  return (
    <div className={className}>
      {cameraOpen && (
        <div className="space-y-2">
          <video ref={videoRef} className="w-full h-40 bg-black rounded object-cover" autoPlay playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={capture} disabled={uploading}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              Capture
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={closeCamera}>Cancel</Button>
          </div>
        </div>
      )}
      {!cameraOpen && (
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept={accept} onChange={handleFile} className="hidden" />
          <div className={`${previewClassName} rounded border bg-muted/40 flex items-center justify-center overflow-hidden flex-shrink-0`}>
            {value ? (
               
              <img src={value} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] text-muted-foreground">No file</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {label}
            </Button>
            {allowCamera && (
              <Button type="button" variant="ghost" size="sm" onClick={openCamera} disabled={uploading}>
                <Camera className="size-4" /> Use camera
              </Button>
            )}
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')} className="text-destructive">
                <X className="size-3" /> Remove
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
