/**
 * Exports: Input, SearchInput, inputVariants (class string), SearchInputProps
 *
 * Input: h-8 rounded-md border-input text-sm; focus = ring-[3px] ring-ring/20 + border-ring;
 *        aria-invalid="true" shows the destructive border.
 * SearchInput: Input with a leading Search icon. Pass onClear to show a clear (X) button while
 *        it has a value. type defaults to "text" (role textbox). containerClassName sizes the wrapper.
 */
import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const inputVariants =
  'flex h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-[color,box-shadow,border-color] duration-100 placeholder:text-muted-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20 dark:bg-input/30 coarse:min-h-10';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(({ className, type, ...props }, ref) => (
  <input type={type} ref={ref} className={cn(inputVariants, className)} {...props} />
));
Input.displayName = 'Input';

export interface SearchInputProps extends React.ComponentProps<'input'> {
  /** Shows a clear button while the input has a value */
  onClear?: () => void;
  containerClassName?: string;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, containerClassName, onClear, type = 'text', value, ...props }, ref) => {
    const showClear = !!onClear && value !== undefined && String(value).length > 0;
    return (
      <div className={cn('relative w-full', containerClassName)}>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={ref}
          type={type}
          value={value}
          className={cn('pl-8 [&::-webkit-search-cancel-button]:hidden', showClear && 'pr-8', className)}
          {...props}
        />
        {showClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    );
  }
);
SearchInput.displayName = 'SearchInput';

export { Input, SearchInput, inputVariants };
