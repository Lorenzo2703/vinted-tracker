import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export default function PwaStatus() {
  const [install, setInstall] = useState<InstallEvent | null>(null)
  const [installed, setInstalled] = useState(() => matchMedia('(display-mode: standalone)').matches)
  const [online, setOnline] = useState(navigator.onLine)
  const [help, setHelp] = useState(false)
  const { needRefresh: [needRefresh], offlineReady: [offlineReady], updateServiceWorker } = useRegisterSW()
  useEffect(() => {
    const onInstall = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent) }
    const onInstalled = () => { setInstalled(true); setInstall(null) }
    const onNetwork = () => setOnline(navigator.onLine)
    window.addEventListener('beforeinstallprompt', onInstall)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener('online', onNetwork)
    window.addEventListener('offline', onNetwork)
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstall)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('online', onNetwork)
      window.removeEventListener('offline', onNetwork)
    }
  }, [])
  return <div className="pwa-controls">
    {!online && <span className="offline">● Offline </span>}
    {needRefresh ? <button className="button subtle" onClick={() => void updateServiceWorker(true)}>Aggiorna app</button> : installed ? <span className="local-badge">App installata</span> : <button className="button subtle" aria-expanded={help} onClick={async () => {
      if (!install) { setHelp(!help); return }
      await install.prompt()
      await install.userChoice
      setInstall(null)
    }}>↓ Installa app</button>}
    {help && <div className="pwa-help"><p>Android / desktop: usa “Installa app” nel menu del browser. Su iPhone: Safari → Condividi → Aggiungi alla schermata Home.</p><p className="note">{offlineReady ? 'App pronta per l’uso offline.' : 'Per l’installazione e l’offline apri la build di produzione su HTTPS (o localhost).'} I dati restano su questo dispositivo.</p></div>}
  </div>
}