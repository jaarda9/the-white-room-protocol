import { toast as sonnerToast } from "sonner";

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

export const useToast = () => {
  return {
    toast: ({ title, description, variant }: ToastProps) => {
      if (variant === "destructive") {
        sonnerToast.error(title || "Error", { description });
      } else {
        sonnerToast(title || "Notice", { description });
      }
    },
    toasts: [],
    dismiss: () => {},
  };
};

export const toast = ({ title, description, variant }: ToastProps) => {
  if (variant === "destructive") {
    sonnerToast.error(title || "Error", { description });
  } else {
    sonnerToast(title || "Notice", { description });
  }
};
