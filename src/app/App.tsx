import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { Toaster } from '@/components/ui/Toaster'
import { CreateTemplateDialog } from '@/components/CreateTemplateDialog'
import { useTemplateStore } from '@/state/templateStore'
import { useTestDataStore } from '@/state/testDataStore'
import { useEditorStore } from '@/state/editorStore'
import { useSettingsStore } from '@/state/settingsStore'
import { DashboardPage } from '@/pages/DashboardPage'
import { TemplatesPage } from '@/pages/TemplatesPage'
import { TemplateLibraryPage } from '@/pages/TemplateLibraryPage'
import { ComparePage } from '@/pages/ComparePage'
import { ApiPage } from '@/pages/ApiPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { HelpPage } from '@/pages/HelpPage'
import { EditorPage } from '@/pages/EditorPage'
import { PreviewPage } from '@/pages/PreviewPage'

export function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Rehydrate from localStorage before rendering routes, so a deep link to
    // /editor/:id does not briefly resolve against an empty catalogue.
    let cancelled = false
    void (async () => {
      useTestDataStore.getState().hydrate()
      useEditorStore.getState().hydrateView()
      useSettingsStore.getState().hydrate()
      await useTemplateStore.getState().hydrate()
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) return <div className="h-screen bg-app" />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="library" element={<TemplateLibraryPage />} />
          <Route path="demo" element={<ComparePage />} />
          <Route path="api" element={<ApiPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="help" element={<HelpPage />} />
        </Route>

        {/* The editor and preview own the full viewport. */}
        <Route path="editor/:templateId" element={<EditorPage />} />
        <Route path="preview/:templateId" element={<PreviewPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <CreateTemplateDialog />
      <Toaster />
    </BrowserRouter>
  )
}
