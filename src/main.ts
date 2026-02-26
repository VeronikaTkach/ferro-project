import './styles.css';
import './intro/intro.css';
import { startBubblesApp } from './bubbles/bubblesApp';
import { showIntroOverlay } from './intro/IntroOverlay';

const app = document.querySelector<HTMLDivElement>('#app')!;
startBubblesApp(app);
showIntroOverlay();