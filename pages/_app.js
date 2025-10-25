import '../styles/globals.css';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
