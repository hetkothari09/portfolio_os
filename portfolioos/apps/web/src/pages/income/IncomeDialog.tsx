import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { incomeApi, type SalaryIncomeDTO, type SalaryIncomeInput } from '@/api/income.api';
import { apiErrorMessage } from '@/api/client';
import { toDecimal } from '@portfolioos/shared';

interface Props {
  open: boolean;
  existing: SalaryIncomeDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

export function IncomeDialog({ open, existing, onClose, onSaved }: Props) {
  const isEdit = !!existing;
  const [employerName, setEmployerName] = useState(existing?.employerName ?? '');
  const [monthlyAmount, setMonthlyAmount] = useState(existing?.monthlyAmount ?? '');
  const [payDay, setPayDay] = useState(existing?.payDay ?? 1);
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const saveMut = useMutation({
    mutationFn: (input: SalaryIncomeInput) =>
      isEdit ? incomeApi.update(existing!.id, input) : incomeApi.create(input),
    onSuccess: () => {
      toast.success(isEdit ? 'Income updated' : 'Income added');
      onSaved();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const submit = () => {
    if (!employerName.trim()) return toast.error('Employer / source name required');
    if (!monthlyAmount || toDecimal(monthlyAmount).lessThanOrEqualTo(0)) {
      return toast.error('Monthly amount required');
    }
    if (payDay < 1 || payDay > 31) return toast.error('Pay day must be between 1 and 31');
    saveMut.mutate({
      employerName: employerName.trim(),
      monthlyAmount,
      payDay,
      isActive,
      notes: notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit income' : 'Add income'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div>
            <Label htmlFor="employerName">Employer / source</Label>
            <Input
              id="employerName"
              placeholder="e.g. Acme Corp, Freelance"
              value={employerName}
              onChange={(e) => setEmployerName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="monthlyAmount">Monthly amount (₹)</Label>
              <Input
                id="monthlyAmount"
                type="number"
                min="0"
                step="1"
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="payDay">Pay day of month</Label>
              <Input
                id="payDay"
                type="number"
                min="1"
                max="31"
                value={payDay}
                onChange={(e) => setPayDay(Number(e.target.value))}
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">Day salary is usually credited</p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Currently active
          </label>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              className="mt-1"
              rows={2}
              value={notes ?? ''}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saveMut.isPending}>
            {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
