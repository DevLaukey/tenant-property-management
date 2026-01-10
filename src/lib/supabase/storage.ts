import { createClient } from '@/lib/supabase/client'

export async function uploadFile(
  file: File,
  bucket: string,
  path: string
): Promise<{ url: string | null; error: string | null }> {
  const supabase = createClient()

  const fileExt = file.name.split('.').pop()
  const fileName = `${Math.random()}.${fileExt}`
  const filePath = `${path}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file)

  if (uploadError) {
    return { url: null, error: uploadError.message }
  }

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath)

  return { url: data.publicUrl, error: null }
}

export async function deleteFile(
  bucket: string,
  path: string
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error } = await supabase.storage
    .from(bucket)
    .remove([path])

  if (error) {
    return { error: error.message }
  }

  return { error: null }
}
