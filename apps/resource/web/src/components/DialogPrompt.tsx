import { useState, useId } from 'react';
import { Button } from '@fxmanager/ui/components/button';
import { AlertCircle, Check, X } from 'lucide-react';

export interface QuickActionPreset {
	label: string;
	value: string;
}

export interface PromptDialogProps {
	isOpen: boolean;
	title: string;
	description?: string;
	placeholder?: string;
	initialValue?: string;
	pattern?: RegExp;
	errorMessage?: string;
	presets?: QuickActionPreset[];
	confirmLabel?: string;
	cancelLabel?: string;
	onConfirm: (value: string) => void;
	onClose: () => void;
}

export function PromptDialog({
	isOpen,
	title,
	description,
	placeholder = 'Enter value...',
	initialValue = '',
	pattern,
	errorMessage = 'Invalid input format',
	presets = [],
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	onConfirm,
	onClose,
}: PromptDialogProps) {
	const [value, setValue] = useState(initialValue);
	const [touched, setTouched] = useState(false);
	const inputId = useId();

	if (!isOpen) return null;

	const validate = (val: string) => (pattern ? pattern.test(val) : true);
	const isValid = validate(value);
	const showError = touched && !isValid && value.length > 0;

	const handleConfirm = (valToSubmit: string) => {
		if (validate(valToSubmit) && valToSubmit.trim().length > 0) {
			onConfirm(valToSubmit);
			onClose();
		} else {
			setTouched(true);
		}
	};

	const handleSubmit = (e?: React.FormEvent) => {
		e?.preventDefault();
		handleConfirm(value);
	};

	const handlePresetClick = (preset: QuickActionPreset) => {
		setValue(preset.value);
		setTouched(true);
		handleConfirm(preset.value);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Escape') {
			onClose();
		}
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
			onKeyDown={handleKeyDown}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby={`${inputId}-title`}
				aria-describedby={description ? `${inputId}-desc` : undefined}
				className="w-full max-w-sm rounded-lg border bg-card/95 text-card-foreground shadow-2xl backdrop-blur-md p-4 flex flex-col gap-3"
			>
				{/* Title & Description */}
				<div className="flex flex-col gap-1">
					<h3
						id={`${inputId}-title`}
						className="text-sm font-semibold tracking-tight"
					>
						{title}
					</h3>
					{description && (
						<p id={`${inputId}-desc`} className="text-xs text-muted-foreground">
							{description}
						</p>
					)}
				</div>

				<form onSubmit={handleSubmit} className="flex flex-col gap-2">
					<div className="relative">
						<input
							id={inputId}
							autoFocus
							type="text"
							value={value}
							onChange={(e) => {
								setValue(e.target.value);
								setTouched(true);
							}}
							placeholder={placeholder}
							className={`w-full rounded-md border bg-background px-3 py-1.5 text-xs shadow-sm outline-none transition-colors ${
								showError
									? 'border-destructive focus:ring-1 focus:ring-destructive'
									: 'focus:border-primary focus:ring-1 focus:ring-primary'
							}`}
						/>
					</div>

					{showError && (
						<div className="flex items-center gap-1.5 text-[11px] text-destructive">
							<AlertCircle className="h-3.5 w-3.5 shrink-0" />
							<span>{errorMessage}</span>
						</div>
					)}

					{presets.length > 0 && (
						<div className="flex flex-col gap-1 pt-1">
							<span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
								Quick Presets
							</span>
							<div className="flex flex-wrap gap-1.5">
								{presets.map((preset) => (
									<button
										key={preset.label}
										type="button"
										onClick={() => handlePresetClick(preset)}
										className="text-[10px] font-medium px-2 py-1 rounded border bg-muted/60 hover:bg-primary hover:text-primary-foreground text-foreground transition-colors cursor-pointer"
									>
										{preset.label}
									</button>
								))}
							</div>
						</div>
					)}

					<div className="flex items-center justify-end gap-2 pt-2 border-t mt-1">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={onClose}
							className="h-8 text-xs gap-1"
						>
							<X className="h-3.5 w-3.5" />
							{cancelLabel}
						</Button>
						<Button
							type="submit"
							size="sm"
							disabled={!isValid || value.trim().length === 0}
							className="h-8 text-xs gap-1"
						>
							<Check className="h-3.5 w-3.5" />
							{confirmLabel}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}
