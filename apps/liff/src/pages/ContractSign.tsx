import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import LoadingSpinner from '../components/LoadingSpinner'
import api from '../lib/api'

interface ContractData {
  id: string
  htmlContent: string
  status: 'pending' | 'signed' | 'expired'
  kycStatus: 'verified' | 'pending' | 'rejected'
  residentName: string
  familyName: string
  templatePdfUrl: string | null
}

export default function ContractSign() {
  const { token } = useParams<{ token: string }>()
  const sigRef = useRef<SignatureCanvas | null>(null)
  const [contract, setContract] = useState<ContractData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasRead, setHasRead] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [rejected, setRejected] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  useEffect(() => {
    const fetchContract = async () => {
      try {
        const res = await api.get(`/api/contracts/token/${token}`)
        const data = res.data as Record<string, any>
        setContract({
          id: data.transactionId ?? data.id,
          htmlContent: data.template?.contentHtml ?? data.htmlContent,
          status: 'pending',
          kycStatus: data.kycVerified ?? data.kycStatus === 'verified' ? 'verified' : 'pending',
          residentName: data.resident?.name ?? data.residentName,
          familyName: data.signerName ?? data.familyName,
          templatePdfUrl: data.template?.pdfUrl ?? null,
        })
      } catch (err) {
        console.error('取得合約失敗', err)
        setError('無法載入合約，連結可能已失效')
      } finally {
        setLoading(false)
      }
    }
    fetchContract()
  }, [token])

  const clearSignature = () => {
    sigRef.current?.clear()
  }

  const handleSign = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      alert('請先簽名')
      return
    }
    setSubmitting(true)
    try {
      const signatureData = sigRef.current.toDataURL('image/png')
      const res = await api.post('/api/contracts/sign', {
        token,
        signatureData,
        agreedToElectronic: true,
        agreedToTerms: true,
      })
      setPdfUrl((res.data as { pdfDownloadUrl?: string })?.pdfDownloadUrl ?? null)
      setCompleted(true)
    } catch (err) {
      console.error('簽署失敗', err)
      alert('簽署失敗，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    setSubmitting(true)
    try {
      await api.post('/api/contracts/reject', { token })
      setRejected(true)
    } catch (err) {
      console.error('拒絕失敗', err)
      alert('操作失敗，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingSpinner message="載入合約中..." />

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-white rounded-xl shadow-lg p-6 text-center max-w-sm md:max-w-md w-full">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  if (!contract) return null

  // Already signed
  if (contract.status === 'signed') {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-sm md:max-w-md w-full">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">合約已簽署</h2>
          <p className="text-gray-500 text-sm">此合約已完成電子簽署。</p>
        </div>
      </div>
    )
  }

  // Expired
  if (contract.status === 'expired') {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-sm md:max-w-md w-full">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">連結已過期</h2>
          <p className="text-gray-500 text-sm">此簽署連結已失效，請聯繫機構重新發送。</p>
        </div>
      </div>
    )
  }

  // Completed signing
  if (completed) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-sm md:max-w-md w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">簽署完成</h2>
          <p className="text-gray-500 text-sm mb-4">合約已成功簽署，感謝您的配合。</p>
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium active:bg-blue-700"
            >
              下載合約 PDF 副本
            </a>
          )}
          <p className="text-gray-400 text-xs mt-3">已簽署合約副本亦將透過 LINE 訊息發送給您</p>
        </div>
      </div>
    )
  }

  // Rejected
  if (rejected) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-sm md:max-w-md w-full">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">已選擇紙本簽署</h2>
          <p className="text-gray-500 text-sm">我們將準備紙本合約，請與機構聯繫安排簽署時間。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8 md:pb-12">
      <div className="bg-white shadow-sm px-4 py-4 md:py-5">
        <h1 className="text-lg md:text-xl lg:text-2xl font-semibold text-gray-800 text-center">合約簽署</h1>
      </div>

      <div className="px-4 mt-4 max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto space-y-4 md:space-y-5">
        {/* KYC status */}
        <div className={`rounded-lg px-4 py-3 md:py-4 text-sm md:text-base flex items-center gap-2 ${
          contract.kycStatus === 'verified'
            ? 'bg-green-50 text-green-700'
            : 'bg-yellow-50 text-yellow-700'
        }`}>
          <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${
            contract.kycStatus === 'verified' ? 'bg-green-500' : 'bg-yellow-500'
          }`} />
          身分驗證狀態：{contract.kycStatus === 'verified' ? '已驗證' : '待驗證'}
        </div>

        {/* Contract info */}
        <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
          <div className="flex justify-between text-sm md:text-base mb-3">
            <span className="text-gray-500">住民姓名</span>
            <span className="text-gray-800 font-medium">{contract.residentName}</span>
          </div>
          <div className="flex justify-between text-sm md:text-base">
            <span className="text-gray-500">簽署人</span>
            <span className="text-gray-800 font-medium">{contract.familyName}</span>
          </div>
        </div>

        {/* Contract content */}
        <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
          <h2 className="text-base md:text-lg font-semibold text-gray-700 mb-3">合約內容</h2>
          {contract.templatePdfUrl ? (
            <iframe
              src={`${api.defaults.baseURL}${contract.templatePdfUrl}`}
              className="w-full border border-gray-200 rounded-lg"
              style={{ height: 480 }}
              title="合約 PDF"
            />
          ) : (
            <div
              className="max-h-80 md:max-h-[500px] lg:max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg p-4 md:p-6 text-sm md:text-base text-gray-700 leading-relaxed md:leading-loose prose prose-sm md:prose-base"
              dangerouslySetInnerHTML={{ __html: contract.htmlContent }}
            />
          )}
        </div>

        {/* 平板以上：告知區塊並排 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
          {/* 電子簽章使用告知 */}
          <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
            <h2 className="text-base md:text-lg font-semibold text-gray-700 mb-3">電子簽章使用告知</h2>
            <div className="bg-blue-50 rounded-lg p-4 md:p-5 text-sm md:text-base text-gray-700 leading-relaxed space-y-2">
              <p>一、依據《電子簽章法》第 4 條，本合約採用電子簽章方式簽署，與紙本簽署具有相同法律效力。</p>
              <p>二、本系統使用臺灣網路認證股份有限公司（TWCA）提供之數位憑證服務，進行身份驗證與數位簽章，並加蓋符合 AATL 國際標準之時間戳記。</p>
              <p>三、您有權選擇不使用電子簽章，改以紙本方式簽署。</p>
              <p>四、簽署完成後，系統將產出含數位簽章之 PDF 文件，並提供副本供您留存。</p>
              <p>五、如有任何疑問，請洽機構行政人員。</p>
            </div>
          </div>

          {/* 個人資料蒐集告知 */}
          <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
            <h2 className="text-base md:text-lg font-semibold text-gray-700 mb-3">個人資料蒐集告知</h2>
            <div className="bg-amber-50 rounded-lg p-4 md:p-5 text-sm md:text-base text-gray-700 leading-relaxed space-y-2">
              <p>依據《個人資料保護法》第 8 條，告知事項如下：</p>
              <p>一、蒐集目的：合約簽署之身份驗證與法律效力確認（代號 069 契約、類似契約或其他法律關係事務）。</p>
              <p>二、蒐集項目：姓名、簽名圖檔、IP 位址、簽署時間、身份驗證結果。</p>
              <p>三、利用期間：合約效期內及届滿後依法令規定之保存期限。</p>
              <p>四、利用地區：中華民國境內。</p>
              <p>五、利用對象：財團法人台北市私立愛愛院。</p>
              <p>六、您得依《個人資料保護法》第 3 條，行使查詢、閱覽、製給複製本、補充或更正、停止蒐集處理利用及刪除等權利。</p>
            </div>
          </div>
        </div>

        {/* 雙重勾選確認 */}
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-5 space-y-3 md:space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hasRead}
              onChange={(e) => setHasRead(e.target.checked)}
              className="accent-blue-600 w-5 h-5 md:w-6 md:h-6 mt-0.5 shrink-0"
            />
            <span className="text-sm md:text-base text-gray-700 font-medium">我已詳細閱讀上述合約內容</span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="accent-blue-600 w-5 h-5 md:w-6 md:h-6 mt-0.5 shrink-0"
            />
            <span className="text-sm md:text-base text-gray-700 font-medium">我已閱讀並同意「電子簽章使用告知」及「個人資料蒐集告知」</span>
          </label>
        </div>

        {/* Signature area — 兩個勾選都完成才顯示 */}
        {hasRead && agreedToTerms && (
          <>
            <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base md:text-lg font-semibold text-gray-700">簽名</h2>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="text-xs md:text-sm text-blue-600 active:text-blue-800"
                >
                  清除重簽
                </button>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
                <SignatureCanvas
                  ref={sigRef}
                  canvasProps={{
                    className: 'w-full touch-none',
                    style: { width: '100%', height: 'var(--sig-height, 200px)' },
                  }}
                  penColor="#1e40af"
                  minWidth={1.5}
                  maxWidth={3}
                />
              </div>
              <p className="text-xs md:text-sm text-gray-400 text-center mt-2">請在上方區域簽名</p>
              <style>{`
                @media (min-width: 768px) { :root { --sig-height: 300px; } }
                @media (min-width: 1024px) { :root { --sig-height: 350px; } }
              `}</style>
            </div>

            {/* Actions — 平板以上並排 */}
            <div className="space-y-3 md:space-y-0 md:flex md:gap-4">
              <button
                type="button"
                onClick={handleSign}
                disabled={submitting}
                className="w-full py-3 md:py-4 rounded-xl bg-blue-600 text-white font-medium text-sm md:text-base active:bg-blue-700 disabled:opacity-50"
              >
                同意採用電子簽章
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={submitting}
                className="w-full md:w-auto md:min-w-[200px] py-3 md:py-4 rounded-xl border border-gray-300 text-gray-600 font-medium text-sm md:text-base active:bg-gray-100 disabled:opacity-50"
              >
                拒絕，改用紙本簽署
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
