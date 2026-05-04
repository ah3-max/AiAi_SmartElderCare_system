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
}

export default function ContractSign() {
  const { token } = useParams<{ token: string }>()
  const sigRef = useRef<SignatureCanvas | null>(null)
  const [contract, setContract] = useState<ContractData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasRead, setHasRead] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [rejected, setRejected] = useState(false)

  useEffect(() => {
    const fetchContract = async () => {
      try {
        const res = await api.get(`/api/contracts/token/${token}`)
        setContract(res.data as ContractData)
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
      await api.post('/api/contracts/sign', {
        token,
        signatureData,
        agreedToElectronic: true,
      })
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
        <div className="bg-white rounded-xl shadow-lg p-6 text-center max-w-sm w-full">
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
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-sm w-full">
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
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-sm w-full">
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
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">簽署完成</h2>
          <p className="text-gray-500 text-sm">合約已成功簽署，感謝您的配合。</p>
        </div>
      </div>
    )
  }

  // Rejected
  if (rejected) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-sm w-full">
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
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white shadow-sm px-4 py-4">
        <h1 className="text-lg font-semibold text-gray-800 text-center">合約簽署</h1>
      </div>

      <div className="px-4 mt-4 max-w-lg mx-auto space-y-4">
        {/* KYC status */}
        <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${
          contract.kycStatus === 'verified'
            ? 'bg-green-50 text-green-700'
            : 'bg-yellow-50 text-yellow-700'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            contract.kycStatus === 'verified' ? 'bg-green-500' : 'bg-yellow-500'
          }`} />
          身分驗證狀態：{contract.kycStatus === 'verified' ? '已驗證' : '待驗證'}
        </div>

        {/* Contract info */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex justify-between text-sm mb-3">
            <span className="text-gray-500">住民姓名</span>
            <span className="text-gray-800 font-medium">{contract.residentName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">簽署人</span>
            <span className="text-gray-800 font-medium">{contract.familyName}</span>
          </div>
        </div>

        {/* Contract content */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-700 mb-3">合約內容</h2>
          <div
            className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg p-4 text-sm text-gray-700 leading-relaxed prose prose-sm"
            dangerouslySetInnerHTML={{ __html: contract.htmlContent }}
          />
        </div>

        {/* Read confirmation */}
        <label className="flex items-center gap-3 bg-white rounded-xl shadow-sm p-4 cursor-pointer">
          <input
            type="checkbox"
            checked={hasRead}
            onChange={(e) => setHasRead(e.target.checked)}
            className="accent-blue-600 w-5 h-5"
          />
          <span className="text-sm text-gray-700 font-medium">我已詳細閱讀上述合約內容</span>
        </label>

        {/* Signature area */}
        {hasRead && (
          <>
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-700">簽名</h2>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="text-xs text-blue-600 active:text-blue-800"
                >
                  清除重簽
                </button>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
                <SignatureCanvas
                  ref={sigRef}
                  canvasProps={{
                    className: 'w-full',
                    style: { width: '100%', height: 200 },
                  }}
                  penColor="#1e40af"
                />
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">請在上方區域簽名</p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleSign}
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium text-sm active:bg-blue-700 disabled:opacity-50"
              >
                同意採用電子簽章
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={submitting}
                className="w-full py-3 rounded-xl border border-gray-300 text-gray-600 font-medium text-sm active:bg-gray-100 disabled:opacity-50"
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
