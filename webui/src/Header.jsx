import { motion } from "framer-motion";
import { haptic } from "./ui";

function NavLink({ href, active, children }) {
  return (
    <motion.a href={href} onTapStart={() => haptic()} whileTap={{ scale: 0.94 }}
      className={`focusable relative rounded-lg px-3.5 py-2 text-[13.5px] font-semibold transition-colors ${active ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-900"}`}>
      {children}
      {active && <motion.span layoutId="navdot" className="absolute inset-x-3 -bottom-[9px] h-[2px] rounded-full bg-accent" />}
    </motion.a>
  );
}

export default function Header({ route }) {
  const on = (p) => (route === p ? true : false);
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3.5 px-6">
        <a href="#/" className="focusable flex items-center gap-3">
          <motion.img
            src="/logo.svg" alt="BankIQ"
            whileHover={{ rotate: 120, scale: 1.06 }}
            whileTap={{ scale: 0.9, rotate: 240 }}
            onHoverStart={() => haptic(10)}
            onTapStart={() => haptic(16)}
            transition={{ type: "spring", stiffness: 220, damping: 16 }}
            className="h-10 w-10 cursor-pointer"
          />
          <span className="flex flex-col leading-none">
            <span className="text-[19px] font-extrabold tracking-tight text-zinc-900">Bank<span className="text-accent-fg">IQ</span></span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Bank Statement Analysis</span>
          </span>
        </a>
        <div className="flex-1" />
        <nav className="flex items-center gap-1">
          <NavLink href="#/" active={on("home")}>Statements</NavLink>
          <NavLink href="#/upload" active={on("upload")}>Upload</NavLink>
        </nav>
      </div>
    </header>
  );
}
