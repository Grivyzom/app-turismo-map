import { ReactNode } from 'react';

type SileoState = "success" | "loading" | "error" | "warning" | "info" | "action";
interface SileoStyles {
    title?: string;
    description?: string;
    badge?: string;
    button?: string;
}
interface SileoButton {
    title: string;
    onClick: () => void;
}
declare const SILEO_POSITIONS: readonly ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"];
type SileoPosition = (typeof SILEO_POSITIONS)[number];
interface SileoOptions {
    title?: string;
    description?: ReactNode | string;
    type?: SileoState;
    position?: SileoPosition;
    duration?: number | null;
    icon?: ReactNode | null;
    styles?: SileoStyles;
    fill?: string;
    roundness?: number;
    autopilot?: boolean | {
        expand?: number;
        collapse?: number;
    };
    button?: SileoButton;
}

type SileoOffsetValue = number | string;
type SileoOffsetConfig = Partial<Record<"top" | "right" | "bottom" | "left", SileoOffsetValue>>;
interface SileoToasterProps {
    children?: ReactNode;
    position?: SileoPosition;
    offset?: SileoOffsetValue | SileoOffsetConfig;
    options?: Partial<SileoOptions>;
    theme?: "light" | "dark" | "system";
}
interface SileoPromiseOptions<T = unknown> {
    loading: SileoOptions;
    success: SileoOptions | ((data: T) => SileoOptions);
    error: SileoOptions | ((err: unknown) => SileoOptions);
    action?: SileoOptions | ((data: T) => SileoOptions);
    position?: SileoPosition;
}
declare const sileo: {
    show: (opts: SileoOptions) => string;
    success: (opts: SileoOptions) => string;
    error: (opts: SileoOptions) => string;
    warning: (opts: SileoOptions) => string;
    info: (opts: SileoOptions) => string;
    action: (opts: SileoOptions) => string;
    promise: <T>(promise: Promise<T> | (() => Promise<T>), opts: SileoPromiseOptions<T>) => Promise<T>;
    dismiss: (id: string) => void;
    clear: (position?: SileoPosition) => void;
};
declare function Toaster({ children, position, offset, options, theme, }: SileoToasterProps): any;

export { Toaster, sileo };
export type { SileoButton, SileoOptions, SileoPosition, SileoState, SileoStyles };
//# sourceMappingURL=index.d.ts.map
