"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Plus, Edit2, Trash2, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Payment {
  _id?: string;
  amount: number;
  paidAt: string | Date;
  currency?: string;
  paymentMethod?: string;
  stripePaymentIntentId?: string;
}

interface PaymentManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectionId: string;
  paymentHistory: Payment[];
  remainingBalance: number;
  total: number;
  onPaymentUpdated?: () => void;
}

export default function PaymentManagementModal({
  open,
  onOpenChange,
  inspectionId,
  paymentHistory,
  remainingBalance,
  total,
  onPaymentUpdated,
}: PaymentManagementModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
  
  // Form state
  const [amount, setAmount] = useState('');
  const [paidAtDate, setPaidAtDate] = useState<Date | undefined>(new Date());
  const [paidAtTime, setPaidAtTime] = useState(format(new Date(), 'HH:mm'));
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setAmount('');
    const now = new Date();
    setPaidAtDate(now);
    setPaidAtTime(format(now, 'HH:mm'));
    setPaymentMethod('Cash');
    setEditingPayment(null);
    setPaymentToDelete(null);
  };

  const startEditing = (payment: Payment) => {
    setEditingPayment(payment);
    setAmount(payment.amount.toString());
    const paymentDate = new Date(payment.paidAt);
    setPaidAtDate(paymentDate);
    setPaidAtTime(format(paymentDate, 'HH:mm'));
    setPaymentMethod(payment.paymentMethod || 'Cash');
  };

  const cancelEditing = () => {
    resetForm();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const validateAmount = (value: string): { valid: boolean; error?: string } => {
    const numValue = parseFloat(value);
    
    if (!value || isNaN(numValue)) {
      return { valid: false, error: 'Amount is required' };
    }
    
    if (numValue <= 0) {
      return { valid: false, error: 'Amount must be greater than 0' };
    }

    // Calculate max allowed amount
    let maxAllowed = remainingBalance;
    if (editingPayment) {
      // When editing, we need to account for the old payment amount being replaced
      const oldAmount = editingPayment.amount || 0;
      maxAllowed = remainingBalance + oldAmount;
    }

    if (numValue > maxAllowed) {
      return { 
        valid: false, 
        error: `Amount cannot exceed remaining balance of ${formatCurrency(maxAllowed)}` 
      };
    }

    return { valid: true };
  };

  const handleCreatePayment = async () => {
    const validation = validateAmount(amount);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid amount');
      return;
    }

    if (!paidAtDate) {
      toast.error('Please select a payment date');
      return;
    }

    // Combine date and time
    const [hours, minutes] = paidAtTime.split(':').map(Number);
    const paymentDateTime = new Date(paidAtDate);
    paymentDateTime.setHours(hours, minutes, 0, 0);

    setSaving(true);
    try {
      const response = await fetch(`/api/inspections/${inspectionId}/payment-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          amount: parseFloat(amount),
          paidAt: paymentDateTime.toISOString(),
          currency: 'usd',
          paymentMethod,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment');
      }

      toast.success('Payment added successfully');
      resetForm();
      onPaymentUpdated?.();
    } catch (error: any) {
      console.error('Error creating payment:', error);
      toast.error(error.message || 'Failed to create payment');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePayment = async () => {
    if (!editingPayment || !editingPayment._id) return;

    const validation = validateAmount(amount);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid amount');
      return;
    }

    if (!paidAtDate) {
      toast.error('Please select a payment date');
      return;
    }

    // Combine date and time
    const [hours, minutes] = paidAtTime.split(':').map(Number);
    const paymentDateTime = new Date(paidAtDate);
    paymentDateTime.setHours(hours, minutes, 0, 0);

    setSaving(true);
    try {
      const response = await fetch(`/api/inspections/${inspectionId}/payment-history`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          paymentId: editingPayment._id,
          amount: parseFloat(amount),
          paidAt: paymentDateTime.toISOString(),
          currency: 'usd',
          paymentMethod,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update payment');
      }

      toast.success('Payment updated successfully');
      resetForm();
      onPaymentUpdated?.();
    } catch (error: any) {
      console.error('Error updating payment:', error);
      toast.error(error.message || 'Failed to update payment');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!paymentToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(
        `/api/inspections/${inspectionId}/payment-history?paymentId=${paymentToDelete}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete payment');
      }

      toast.success('Payment deleted successfully');
      setPaymentToDelete(null);
      onPaymentUpdated?.();
    } catch (error: any) {
      console.error('Error deleting payment:', error);
      toast.error(error.message || 'Failed to delete payment');
    } finally {
      setDeleting(false);
    }
  };

  const isStripePayment = (payment: Payment) => {
    return !!payment.stripePaymentIntentId;
  };

  const amountValidation = validateAmount(amount);
  const isFormValid = amountValidation.valid && paidAtDate && paidAtTime;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Payments</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Remaining Balance Display */}
            <div className="p-4 bg-muted rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold">{formatCurrency(total)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Remaining Balance</p>
                  <p className={`text-2xl font-bold ${remainingBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {formatCurrency(remainingBalance)}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Form */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-medium text-sm">
                {editingPayment ? 'Edit Payment' : 'Add New Payment'}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">
                    Amount <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={amountValidation.valid === false ? 'border-destructive' : ''}
                  />
                  {amountValidation.valid === false && (
                    <p className="text-xs text-destructive">{amountValidation.error}</p>
                  )}
                  {amount && amountValidation.valid && (
                    <p className="text-xs text-muted-foreground">
                      Maximum allowed: {formatCurrency(editingPayment ? remainingBalance + (editingPayment.amount || 0) : remainingBalance)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>
                    Payment Date & Time <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={`w-full justify-start text-left font-normal ${!paidAtDate && 'text-muted-foreground'}`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {paidAtDate ? format(paidAtDate, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={paidAtDate}
                          onSelect={setPaidAtDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={paidAtTime}
                      onChange={(e) => setPaidAtTime(e.target.value)}
                      className="w-32"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Input
                    id="paymentMethod"
                    type="text"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    placeholder="Cash, Check, Bank Transfer, etc."
                  />
                </div>
              </div>

              <div className="flex gap-2">
                {editingPayment ? (
                  <>
                    <Button
                      onClick={handleUpdatePayment}
                      disabled={saving || !isFormValid}
                    >
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Update Payment
                    </Button>
                    <Button
                      variant="outline"
                      onClick={cancelEditing}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleCreatePayment}
                    disabled={saving || !isFormValid}
                  >
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Plus className="mr-2 h-4 w-4" />
                    Add Payment
                  </Button>
                )}
              </div>
            </div>

            {/* Payment History Table */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm">Payment History</h3>
              
              {paymentHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No payments recorded yet</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentHistory.map((payment, index) => {
                        const isStripe = isStripePayment(payment);
                        const isEditing = editingPayment?._id === payment._id;
                        const paymentId = payment._id || `payment-${index}`;
                        
                        return (
                          <TableRow key={paymentId}>
                            <TableCell>
                              {format(new Date(payment.paidAt), 'MMM dd, yyyy HH:mm')}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(payment.amount)}
                            </TableCell>
                            <TableCell>
                              {payment.paymentMethod || 'N/A'}
                            </TableCell>
                            <TableCell>
                              {isStripe ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                  Stripe
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                  Manual
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {isStripe ? (
                                  <span className="text-xs text-muted-foreground">Read-only</span>
                                ) : (
                                  <>
                                    {!isEditing && (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => startEditing(payment)}
                                          className="h-8 px-2"
                                        >
                                          <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => payment._id && setPaymentToDelete(payment._id)}
                                          disabled={!payment._id}
                                          className="h-8 px-2 text-destructive hover:text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                    {isEditing && (
                                      <span className="text-xs text-muted-foreground">Editing...</span>
                                    )}
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || deleting}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!paymentToDelete} onOpenChange={(open) => !open && setPaymentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeletePayment} 
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

