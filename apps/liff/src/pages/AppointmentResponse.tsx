import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import api from '../lib/api'
import { getLineUserId } from '../lib/liff'

interface AppointmentData {
  id: string
  residentName: string
  date: string
  time: string
  hospital: string
  department: string
  respondedAt?: string
  response?: string
}

export default function AppointmentResponse() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const [appointment, setAppointment] = useState<AppointmentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const lineUserId = await getLineUserId()
        const res = await api.get('/api/appointments/response', {
          params: { appointmentId, lineUserId },
        })
        const data = res.data as AppointmentData

        // Check if less than 24 hours before appointment
        const appointmentTime = new Date(`${data.date}T${data.time}`)
        const hoursUntil = (appointmentTime.getTime() - Date.now()) / (1000 * 60 * 60)
        if (hoursUntil < 24) {
          setLocked(true)
        }

        if (data.respondedAt) {
          setSubmitted(true)
          setSelectedOption(data.response || null)
        }

        setAppointment(data)
      } catch (err) {
        console.error('取得就診資料失敗', err)
        setError('無法載入就診資料')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [appointmentId])

  const handleSubmit = async (option: 'accompany' | 'assist') => {
    setSubmitting(true)
    try {
      const lineUserId = await getLineUserId()
      await api.post('/api/appointments/response', {
        appointmentId,
        lineUserId,
        response: option,
      })
      setSelectedOption(option)
      setSubmitted(true)
    } catch (err) {
      console.error('回覆失敗', err)
      alert('回覆失敗，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingSpinner message="載入就診資料..." />

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-white rounded-xl shadow-lg p-6 text-center max-w-sm w-full">
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  if (!appointment) return null

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white shadow-sm px-4 py-4">
        <h1 className="text-lg font-semibold text-gray-800 text-center">就診通知</h1>
      </div>

      <div className="px-4 mt-4 max-w-lg mx-auto space-y-4">
        {/* Appointment details card */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-700 mb-3">就診資訊</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">住民姓名</span>
              <span className="text-gray-800 font-medium">{appointment.residentName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">就診日期</span>
              <span className="text-gray-800 font-medium">{appointment.date}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">就診時間</span>
              <span className="text-gray-800 font-medium">{appointment.time}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">醫療院所</span>
              <span className="text-gray-800 font-medium">{appointment.hospital}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">就診科別</span>
              <span className="text-gray-800 font-medium">{appointment.department}</span>
            </div>
          </div>
        </div>

        {/* Locked state */}
        {locked && !submitted && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 text-center">
            <p className="text-orange-800 font-medium text-sm mb-2">
              距離就診時間已不足 24 小時，無法線上回覆
            </p>
            <p className="text-orange-700 text-sm">
              如需變更，請直接來電聯繫
            </p>
            <a
              href="tel:0223456789"
              className="inline-block mt-3 px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium text-sm active:bg-orange-700"
            >
              撥打 02-2345-6789
            </a>
          </div>
        )}

        {/* Already submitted */}
        {submitted && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-800 font-medium text-sm">
              已回覆：{selectedOption === 'accompany' ? '家屬親自陪同' : '需機構協助'}
            </p>
          </div>
        )}

        {/* Response options */}
        {!locked && !submitted && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 text-center">請選擇您的回覆方式</p>

            <button
              onClick={() => handleSubmit('accompany')}
              disabled={submitting}
              className="w-full bg-white border-2 border-blue-200 rounded-xl p-5 text-left active:bg-blue-50 disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">家屬親自陪同</p>
                  <p className="text-xs text-gray-500 mt-0.5">我會親自陪同長輩前往就醫</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleSubmit('assist')}
              disabled={submitting}
              className="w-full bg-white border-2 border-green-200 rounded-xl p-5 text-left active:bg-green-50 disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">需機構協助</p>
                  <p className="text-xs text-gray-500 mt-0.5">請機構安排照服員陪同就醫</p>
                </div>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
