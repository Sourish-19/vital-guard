import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // 1. Try standard window scroll (good practice)
    window.scrollTo(0, 0);

    // 2. Target your Dashboard's specific scroll container
    // Your App.tsx uses a <main> tag with 'overflow-y-auto', so WE MUST SCROLL THAT.
    const mainContainer = document.querySelector('main');
    if (mainContainer) {
      mainContainer.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto" // 'auto' is instant, 'smooth' for animation
      });
    }
  }, [pathname]);

  return null;
}