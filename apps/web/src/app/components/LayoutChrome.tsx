"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";
import HostFloating from "./HostFloating";
import ActiveRoomPanel from "./ActiveRoomPanel";

export default function LayoutChrome() {
  const pathname = usePathname();
  const hideOnPrivate = pathname?.startsWith("/private");

  return (
    <>
      {!hideOnPrivate && <Footer />}
      <ActiveRoomPanel />
      {!hideOnPrivate && <HostFloating />}
    </>
  );
}
