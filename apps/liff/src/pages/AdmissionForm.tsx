import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import StepIndicator from '../components/StepIndicator'
import LoadingSpinner from '../components/LoadingSpinner'
import api from '../lib/api'
import { getLineUserId } from '../lib/liff'

const STEPS = ['基本資料', '照護評估', '需求確認']

const MEDICAL_TAGS = [
  '高血壓', '糖尿病', '心臟病', '中風', '失智症',
  '帕金森氏症', '洗腎', '氣切', '鼻胃管', '尿管',
]

const RELATIONS = ['子女', '配偶', '媳婦/女婿', '孫子女', '其他親屬', '朋友', '社工']

const schema = z.object({
  applicantName: z.string().min(1, '請輸入申請人姓名'),
  contactPhone: z.string().regex(/^09\d{8}$/, '請輸入正確的手機號碼（09xx-xxx-xxx）'),
  relation: z.string().min(1, '請選擇與住民關係'),
  seniorName: z.string().min(1, '請輸入長輩姓名'),
  birthYear: z.coerce.number().min(1900, '請輸入有效年份').max(new Date().getFullYear(), '請輸入有效年份'),
  gender: z.enum(['male', 'female'], { required_error: '請選擇性別' }),
  adlScore: z.coerce.number().min(0).max(100),
  medicalTags: z.array(z.string()),
  preferredRoom: z.string().min(1, '請選擇房型'),
  expectedDate: z.date({ required_error: '請選擇預計入住日期' }),
  privacyConsent: z.literal(true, { errorMap: () => ({ message: '請勾選同意個資蒐集聲明' }) }),
})

type FormData = z.infer<typeof schema>

export default function AdmissionForm() {
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    watch,
    setValue,
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      adlScore: 50,
      medicalTags: [],
      privacyConsent: false as unknown as true,
    },
  })

  const adlScore = watch('adlScore')
  const selectedDate = watch('expectedDate')
  const medicalTags = watch('medicalTags')

  const nextStep = async () => {
    let fields: (keyof FormData)[] = []
    if (step === 1) fields = ['applicantName', 'contactPhone', 'relation']
    if (step === 2) fields = ['seniorName', 'birthYear', 'gender']
    const valid = await trigger(fields)
    if (valid) setStep(step + 1)
  }

  const prevStep = () => setStep(step - 1)

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    try {
      const lineUserId = await getLineUserId()
      await api.post('/api/admissions', {
        ...data,
        expectedDate: data.expectedDate.toISOString().split('T')[0],
        lineUserId,
      })
      setSubmitted(true)
    } catch (err) {
      console.error('提交失敗', err)
      alert('提交失敗，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">申請已送出</h2>
          <p className="text-gray-500 text-sm">感謝您的申請，我們將盡快與您聯繫。</p>
        </div>
      </div>
    )
  }

  if (submitting) {
    return <LoadingSpinner message="正在送出申請..." />
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white shadow-sm">
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-800 text-center">入住預約表單</h1>
        </div>
        <StepIndicator steps={STEPS} currentStep={step} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 mt-4 max-w-lg mx-auto">
        {/* Step 1: 基本資料 */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-700">申請人基本資料</h2>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">申請人姓名</label>
              <input
                {...register('applicantName')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="請輸入姓名"
              />
              {errors.applicantName && <p className="text-red-500 text-xs mt-1">{errors.applicantName.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">聯絡電話</label>
              <input
                {...register('contactPhone')}
                type="tel"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0912345678"
              />
              {errors.contactPhone && <p className="text-red-500 text-xs mt-1">{errors.contactPhone.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">與住民關係</label>
              <select
                {...register('relation')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">請選擇</option>
                {RELATIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {errors.relation && <p className="text-red-500 text-xs mt-1">{errors.relation.message}</p>}
            </div>
          </div>
        )}

        {/* Step 2: 照護評估 */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-700">長輩照護評估</h2>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">長輩姓名</label>
              <input
                {...register('seniorName')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="請輸入長輩姓名"
              />
              {errors.seniorName && <p className="text-red-500 text-xs mt-1">{errors.seniorName.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">出生年份（西元）</label>
              <input
                {...register('birthYear')}
                type="number"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="例如：1940"
              />
              {errors.birthYear && <p className="text-red-500 text-xs mt-1">{errors.birthYear.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">性別</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input {...register('gender')} type="radio" value="male" className="accent-blue-600" />
                  <span className="text-sm text-gray-700">男</span>
                </label>
                <label className="flex items-center gap-2">
                  <input {...register('gender')} type="radio" value="female" className="accent-blue-600" />
                  <span className="text-sm text-gray-700">女</span>
                </label>
              </div>
              {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                ADL 日常生活功能評估分數：<span className="text-blue-600 font-semibold">{adlScore}</span>
              </label>
              <input
                {...register('adlScore')}
                type="range"
                min="0"
                max="100"
                step="5"
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>0（完全依賴）</span>
                <span>100（完全獨立）</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">醫療狀況（可複選）</label>
              <div className="grid grid-cols-2 gap-2">
                {MEDICAL_TAGS.map((tag) => (
                  <label key={tag} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <input
                      type="checkbox"
                      value={tag}
                      checked={medicalTags?.includes(tag)}
                      onChange={(e) => {
                        const current = getValues('medicalTags') || []
                        if (e.target.checked) {
                          setValue('medicalTags', [...current, tag])
                        } else {
                          setValue('medicalTags', current.filter((t) => t !== tag))
                        }
                      }}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-gray-700">{tag}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: 需求確認 */}
        {step === 3 && (
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h2 className="text-base font-semibold text-gray-700">需求確認</h2>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">偏好房型</label>
              <div className="space-y-2">
                {[
                  { value: 'single', label: '單人房' },
                  { value: 'double', label: '雙人房' },
                  { value: 'quad', label: '四人房' },
                ].map((room) => (
                  <label
                    key={room.value}
                    className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3 cursor-pointer"
                  >
                    <input {...register('preferredRoom')} type="radio" value={room.value} className="accent-blue-600" />
                    <span className="text-sm text-gray-700">{room.label}</span>
                  </label>
                ))}
              </div>
              {errors.preferredRoom && <p className="text-red-500 text-xs mt-1">{errors.preferredRoom.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">預計入住日期</label>
              <div className="flex justify-center">
                <DayPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setValue('expectedDate', date, { shouldValidate: true })}
                  disabled={{ before: new Date() }}
                />
              </div>
              {errors.expectedDate && <p className="text-red-500 text-xs mt-1">{errors.expectedDate.message}</p>}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-yellow-800 mb-2">個資蒐集聲明</h3>
              <p className="text-xs text-yellow-700 leading-relaxed mb-3">
                愛愛院依據個人資料保護法，蒐集您的個人資料僅供入住評估及照護服務使用。您的資料將受到嚴格保護，不會提供予第三方。您有權隨時要求查閱、更正或刪除您的個人資料。
              </p>
              <label className="flex items-start gap-2">
                <input
                  {...register('privacyConsent')}
                  type="checkbox"
                  className="accent-blue-600 mt-0.5"
                />
                <span className="text-sm text-gray-700">我已閱讀並同意上述個資蒐集聲明</span>
              </label>
              {errors.privacyConsent && <p className="text-red-500 text-xs mt-1">{errors.privacyConsent.message}</p>}
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <button
              type="button"
              onClick={prevStep}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 font-medium text-sm active:bg-gray-100"
            >
              上一步
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium text-sm active:bg-blue-700"
            >
              下一步
            </button>
          ) : (
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium text-sm active:bg-blue-700"
            >
              送出申請
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
