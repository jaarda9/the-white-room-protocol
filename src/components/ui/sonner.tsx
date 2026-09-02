import { Toaster as SonnerToaster } from "sonner";

export const Toaster = (props: React.ComponentProps<typeof SonnerToaster>) => {
  return (
    <SonnerToaster
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-[#070d18] group-[.toaster]:text-[#e5ecf4] group-[.toaster]:border-cyan-500/40 group-[.toaster]:shadow-lg font-mono",
          description: "group-[.toast]:text-gray-400",
          actionButton: "group-[.toast]:bg-cyan-400 group-[.toast]:text-black font-mono",
          cancelButton: "group-[.toast]:bg-gray-800 group-[.toast]:text-gray-300",
        },
      }}
      {...props}
    />
  );
};
