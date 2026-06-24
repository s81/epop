export function FormField({
  label,
  name,
  defaultValue,
  required,
  dir,
  type = 'text',
  step,
  min,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  required?: boolean;
  dir?: 'rtl' | 'ltr';
  type?: string;
  step?: string;
  min?: string;
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        name={name}
        type={type}
        step={step}
        min={min}
        defaultValue={defaultValue ?? ''}
        required={required}
        dir={dir}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}
