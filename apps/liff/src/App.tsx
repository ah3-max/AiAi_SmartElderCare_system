import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { initLiff } from './lib/liff'
import LoadingSpinner from './components/LoadingSpinner'
import AdmissionForm from './pages/AdmissionForm'
import AppointmentResponse from './pages/AppointmentResponse'
import VisitReservation from './pages/VisitReservation'
import ContractSign from './pages/ContractSign'

function NotAvailable({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="bg-white rounded-xl shadow p-6 text-center max-w-sm">
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  )
}

export default function App() {
  const [liffReady, setLiffReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    initLiff()
      .then(() => setLiffReady(true))
      .catch(() => {
        setError('LINE 初始化失敗，請重新開啟頁面')
        setLiffReady(true)
      })
  }, [])

  if (!liffReady) {
    return <LoadingSpinner message="正在載入..." />
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
        <div className="bg-white rounded-xl shadow p-6 text-center max-w-sm">
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/liff/admission" element={<AdmissionForm />} />
        <Route path="/liff/appointment/:appointmentId/response" element={<AppointmentResponse />} />
        <Route path="/liff/appointment" element={<NotAvailable message="請從 LINE 通知中的連結開啟就診回覆頁面" />} />
        <Route path="/liff/visit" element={<VisitReservation />} />
        <Route path="/liff/contract/:token" element={<ContractSign />} />
        <Route path="/liff/contract" element={<NotAvailable message="請從 LINE 通知中的連結開啟合約簽署頁面" />} />
        <Route path="*" element={<NotAvailable message="找不到頁面" />} />
      </Routes>
    </div>
  )
}
