'use client'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

export function EquipmentDialog({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: React.ReactNode }) {
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl" showCloseButton={false} aria-describedby={undefined} onInteractOutside={e => e.preventDefault()} onEscapeKeyDown={e => { if (busy) e.preventDefault() }}>
      <DialogTitle className="sr-only">{title}</DialogTitle>
      {children}
    </DialogContent>
  </Dialog>
}
