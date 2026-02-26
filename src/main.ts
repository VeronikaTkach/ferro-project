import './styles.css';
import { startBubblesApp } from './bubbles/bubblesApp';

const app = document.querySelector<HTMLDivElement>('#app')!;
startBubblesApp(app);