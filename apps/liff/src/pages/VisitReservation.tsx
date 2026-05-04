import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import LoadingSpinner from '../components/LoadingSpinner'
import api from '../lib/api'
import { getLineUserId } from '../lib/liff'

interface Resident {
  residentId: string
  residentName: string
  building: string
  floor: number
  relation: string
  zoneId: string | null
  zoneLabel: string | null
}

interface Slot {
  id: string
  startTime: string
  endTime: string
  remaining: number
  isFull: boolean
}

const schema = z.object({
  visitorName: z.string().min(1, '請輸入訪客姓名'),
  guestCount: z.coerce.number().min(1, '至少 1 人').max(2, '最多 2 位訪客'),
})

type FormData = z.infer<typeof schema>

export default function VisitReservation() {
  const [residents, setResidents] = useState<Resident[]>([])
  const [selectedResidentId, setSelectedResidentId] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reservationId, setReservationId] = useState<string | null>(null)
  const [bootLoading, setBootLoading] = useState(true)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { guestCount: 1 },
  })

  const selectedResident = residents.find((r) => r.residentId === selectedResidentId)
  const zoneIdForResident = selectedResident?.zoneId ?? null

  useEffect(() => {
    ;(async () => {
      try {
        const lineUserId = await getLineUserId()
        const res = await api.get('/api/visits/residents', { params: { lineUserId } })
        setResidents(res.data ?? [])
      } catch (err) {
        console.error('讀取家屬資料失敗', err)
      } finally {
        setBootLoading(false)
      }
    })()
  }, [])

  const fetchSlots = async (date: Date, zoneId: string) => {
    setLoadingSlots(true)
    setSelectedSlotId(null)
    try {
      const dateStr = date.toISOString().split('T')[0]
      const res = await api.get('/api/visits/slots', { params: { zoneId, date: dateStr } })
      setSlots(res.data?.slots ?? [])
    } catch (err) {
      console.error('取得時段失敗', err)
      setSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (!date || !zoneIdForResident) return
    setSelectedDate(date)
    fetchSlots(date, zoneIdForResident)
  }

  const onSubmit = async (data: FormData) => {
    if (!selectedResidentId || !selectedDate || !selectedSlotId || !zoneIdForResident) {
      alert('請完成長者、日期與時段選擇')
      return
    }
    setSubmitting(true)
    try {
      const lineUserId = await getLineUserId()
      const res = await api.post('/api/visits', {
        zoneId: zoneIdForResident,
        timeSlotId: selectedSlotId,
        residentId: selectedResidentId,
        visitDate: selectedDate.toISOString().split('T')[0],
        visitorName: data.visitorName,
        guestCount: data.guestCount,
        lineUserId,
      })
      setReservationId(res.data?.id)
    } catch (err: any) {
      console.error('預約失敗', err)
      alert(err?.response?.data?.message || '預約失敗，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async () => {
    if (!reservationId) return
    if (!confirm('確定要取消此預約嗎？')) return
    try {
      const lineUserId = await getLineUserId()
      await api.patch(`/api/visits/${reservationId}/cancel`, { lineUserId })
      alert('預約已取消')
      setReservationId(null)
      setSelectedSlotId(null)
      setSelectedDate(undefined)
    } catch (err: any) {
      alert(err?.response?.data?.message || '取消失敗')
    }
  }

  if (bootLoading) return <LoadingSpinner message="讀取資料中..." />

  if (reservationId) {
    const selectedSlot = slots.find((s) => s.id === selectedSlotId)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">預約成功</h2>
          <p className="text-gray-600 text-sm">
            {selectedResident?.residentName}
          </p>
          <p className="text-gray-500 text-sm">
            {selectedDate?.toLocaleDateString('zh-TW')} {selectedSlot && `${selectedSlot.startTime}-${selectedSlot.endTime}`}
          </p>
          <p className="text-gray-400 text-xs mt-2">請於預約時間準時到訪</p>
          <button
            onClick={handleCancel}
            className="mt-6 w-full py-2.5 rounded-lg border border-red-500 text-red-500 text-sm active:bg-red-50"
          >
            取消預約
          </button>
        </div>
      </div>
    )
  }

  if (submitting) return <LoadingSpinner message="正在送出預約..." />

  if (residents.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-sm w-full">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">尚未綁定長者</h2>
          <p className="text-gray-500 text-sm">請先聯絡機構進行家屬身份綁定，才能使用探訪預約功能。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white shadow-sm px-4 py-4">
        <h1 className="text-lg font-semibold text-gray-800 text-center">探訪預約</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 mt-4 max-w-lg mx-auto space-y-4">
        {/* 探訪對象 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-700 mb-3">探訪對象</h2>
          <select
            value={selectedResidentId}
            onChange={(e) => {
              setSelectedResidentId(e.target.value)
              setSelectedDate(undefined)
              setSlots([])
              setSelectedSlotId(null)
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white"
          >
            <option value="">請選擇長者</option>
            {residents.map((r) => (
              <option key={r.residentId} value={r.residentId}>
                {r.residentName}（{r.building}棟 {r.floor}F，關係：{r.relation}）
              </option>
            ))}
          </select>
        </div>

        {/* 日期 */}
        {selectedResidentId && zoneIdForResident && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-700 mb-3">選擇探訪日期</h2>
            <div className="flex justify-center">
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={{ before: new Date() }}
              />
            </div>
          </div>
        )}

        {/* 時段 */}
        {selectedDate && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-700 mb-3">
              選擇時段
              <span className="text-xs text-gray-400 font-normal ml-2">
                {selectedDate.toLocaleDateString('zh-TW')}
              </span>
            </h2>

            {loadingSlots ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">當日無可預約時段</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {slots.map((slot) => {
                  const isSelected = selectedSlotId === slot.id
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={slot.isFull}
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`rounded-lg px-3 py-3 text-center transition-colors ${
                        slot.isFull
                          ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                          : isSelected
                            ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                            : 'bg-gray-50 text-gray-700 border border-gray-200 active:bg-blue-50'
                      }`}
                    >
                      <p className="text-sm font-medium">{slot.startTime}-{slot.endTime}</p>
                      <p className={`text-xs mt-0.5 ${slot.isFull ? 'text-gray-300' : isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                        {slot.isFull ? '已額滿' : `剩餘 ${slot.remaining} 位`}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Visitor info */}
        {selectedSlotId && (
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-700">訪客資訊</h2>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">訪客姓名</label>
              <input
                {...register('visitorName')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="請輸入姓名"
              />
              {errors.visitorName && <p className="text-red-500 text-xs mt-1">{errors.visitorName.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">同行人數（含本人，最多 2 人）</label>
              <select
                {...register('guestCount')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value={1}>1 人</option>
                <option value={2}>2 人</option>
              </select>
              {errors.guestCount && <p className="text-red-500 text-xs mt-1">{errors.guestCount.message}</p>}
            </div>
          </div>
        )}

        {selectedSlotId && (
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium text-sm active:bg-blue-700"
          >
            確認預約
          </button>
        )}
      </form>
    </div>
  )
}
