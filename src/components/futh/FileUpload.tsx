'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, Upload, X, Loader2, FileText, FileImage, FileSignature, FileType, FileCheck2 } from 'lucide-react'
import { toast } from 'sonner'

type Props = {
  type?: string
  accept?: string
  label?: string
  value?: string | null
  // Optional fileName/mimeType hints so the preview can render a file-type icon
  // for non-image uploads (PDFs, Word docs, etc.) instead of the broken "No file"
  // text the previous version showed.
  valueFileName?: string
  valueMimeType?: string
  // onChange is called with the URL after a successful upload.
  // Optionally also receives the original fileName, fileSize (bytes), and mimeType
  // when the caller needs the metadata (e.g. the Documents page).
  onChange: (url: string, fileName?: string, fileSize?: number, mimeType?: string) => void
  allowCamera?: boolean
  className?: string
  previewClassName?: string
  // If true, images > 1.5MB are auto-compressed client-side via <canvas> to a
  // long-edge max of 1600px and re-encoded as JPEG quality 0.82. Defaults to true.
  // Set to false for signature uploads where you want the raw PNG to preserve
  // transparency and pixel-perfect strokes.
  compressImages?: boolean
}

// Pick the right icon for a file based on its extension / mime type.
function iconFor(fileName?: string | null, mimeType?: string | null) {
  const name = (fileName || '').toLowerCase()
  const mt = (mimeType || '').toLowerCase()
  if (mt.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|tiff?)$/i.test(name)) return FileImage
  if (mt === 'application/pdf' || name.endsWith('.pdf')) return FileText
  if (/\.(doc|docx)$/i.test(name)) return FileSignature
  if (/\.(xls|xlsx|csv)$/i.test(name)) return FileType
  if (/\.(ppt|pptx)$/i.test(name)) return FileCheck2
  return FileText
}

// File-type → tailwind color class for the icon background.
function colorFor(fileName?: string | null, mimeType?: string | null) {
  const name = (fileName || '').toLowerCase()
  const mt = (mimeType || '').toLowerCase()
  if (mt.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|tiff?)$/i.test(name)) return 'text-blue-600'
  if (mt === 'application/pdf' || name.endsWith('.pdf')) return 'text-red-600'
  if (/\.(doc|docx)$/i.test(name)) return 'text-blue-700'
  if (/\.(xls|xlsx|csv)$/i.test(name)) return 'text-green-700'
  if (/\.(ppt|pptx)$/i.test(name)) return 'text-orange-600'
  return 'text-muted-foreground'
}

// Compress an image File client-side via <canvas>. Returns a new File
// (JPEG, quality 0.82) sized so the longest edge is ≤ maxEdge px.
// Skips compression for tiny files (< 500KB) and returns the original.
async function compressImage(file: File, maxEdge = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.size < 500 * 1024) return file // < 500KB — leave alone
  // PNGs with transparency would lose it on JPEG. Keep PNG if small enough; otherwise still compress.
  return new Promise<File>((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxEdge || height > maxEdge) {
        if (width >= height) {
          height = Math.round((height * maxEdge) / width)
          width = maxEdge
        } else {
          width = Math.round((width * maxEdge) / height)
          height = maxEdge
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }
      ctx.fillStyle = '#ffffff' // flatten transparency for JPEG
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return }
        // Preserve original extension but with .jpg for compressed JPEG
        const newName = file.name.replace(/\.(png|webp|bmp|tiff?)$/i, '.jpg')
        resolve(new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() }))
      }, 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

export default function FileUpload({
  type = 'general',
  accept = 'image/*',
  label = 'Upload file',
  value,
  valueFileName,
  valueMimeType,
  onChange,
  allowCamera = false,
  className = '',
  previewClassName = 'size-24',
  compressImages = true,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [previewFileName, setPreviewFileName] = useState<string | null>(null)
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true)
    try {
      // Compress images client-side to keep the payload small (≤ ~2MB even
      // for high-res passport photos). This avoids the "unexpected tokens"
      // body-parser error users were hitting on >10MB uploads.
      let toUpload = file
      if (compressImages && file.type.startsWith('image/')) {
        try {
          toUpload = await compressImage(file)
          if (toUpload.size < file.size) {
            toast.success(`Image compressed: ${(file.size / 1024).toFixed(0)}KB → ${(toUpload.size / 1024).toFixed(0)}KB`)
          }
        } catch {
          // Compression failed — fall back to the original file.
          toUpload = file
        }
      }
      const fd = new FormData()
      fd.append('file', toUpload)
      fd.append('type', type)
      const res = await fetch('/api/uploads', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setPreviewFileName(data.fileName || toUpload.name)
      setPreviewMimeType(data.mimeType || toUpload.type)
      onChange(data.url, data.fileName, data.fileSize, data.mimeType)
      toast.success('File uploaded')
    } catch (e: any) {
      toast.error(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [type, onChange, compressImages])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    // Reset the input value so the same file can be picked again after a remove
    e.target.value = ''
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

  // === Preview rendering ===
  // The previous version only rendered <img> for the preview, which meant PDFs,
  // Word docs, and other non-image files showed "No file" — looking broken.
  // Now: images render as <img>; non-image files show a file-type icon + the
  // filename so the user has visual confirmation that the file was uploaded.
  const fileName = previewFileName || valueFileName || (value ? value.split('/').pop() || '' : '')
  const mimeType = previewMimeType || valueMimeType || null
  const isImage = mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|tiff?)$/i.test(fileName || '')
  const PreviewIcon = iconFor(fileName, mimeType)
  const iconColor = colorFor(fileName, mimeType)

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
          <div className={`${previewClassName} rounded border bg-muted/40 flex flex-col items-center justify-center overflow-hidden flex-shrink-0 relative`}>
            {value && isImage ? (
              <img src={value} alt="preview" className="w-full h-full object-cover" />
            ) : value ? (
              <div className="flex flex-col items-center justify-center gap-1 p-2 w-full h-full">
                <PreviewIcon className={`size-6 ${iconColor}`} />
                {fileName && (
                  <span className="text-[9px] text-muted-foreground text-center line-clamp-2 break-all leading-tight" title={fileName}>
                    {fileName.length > 24 ? fileName.slice(0, 20) + '…' : fileName}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground">No file</span>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
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
              <Button type="button" variant="ghost" size="sm" onClick={() => { setPreviewFileName(null); setPreviewMimeType(null); onChange('') }} className="text-destructive">
                <X className="size-3" /> Remove
              </Button>
            )}
            {compressImages && (
              <p className="text-[9px] text-muted-foreground">Images auto-compressed. Max 50MB.</p>
            )}
            {!compressImages && (
              <p className="text-[9px] text-muted-foreground">Max 50MB.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
