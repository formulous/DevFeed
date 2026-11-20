import { TextField } from '@onyx/components/input/text-field';
import type { TextFieldProps } from '@onyx/components/input/text-field.interface';
import { cn } from '@/lib/cn';

export function TextInput({ className, ...props }: TextFieldProps) {
  return <TextField {...props} className={cn('border-line bg-input text-fg placeholder:text-fg-muted', className)} />;
}
