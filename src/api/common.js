// 通用上传接口
import http from './http'

/**
 * 通用文件上传（商品图、评价图等）
 * @param {File} file 原始文件
 * @param {string} biz 子目录：goods / review / avatar / chat
 * @returns {Promise<{id,url,name,size}>} 后端返回的访问 URL（相对路径 /static/upload/...）
 *
 * 注：不要在 config 里手动写 `Content-Type: multipart/form-data`——不带 boundary，
 * Spring/Tomcat 9 解析时会以 400/415 处理；让 axios 自动把 FormData 序列化成
 * `multipart/form-data; boundary=...` 才能让 @RequestParam MultipartFile 收到。
 */
export const uploadFile = (file, biz) => {
  const fd = new FormData()
  fd.append('file', file)
  return http.post('/common/upload', fd, {
    params: biz ? { biz } : undefined,
  })
}