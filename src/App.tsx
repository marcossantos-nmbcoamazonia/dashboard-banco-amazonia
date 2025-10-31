import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Layout from "./components/Layout/Layout"
import Capa from "./pages/Capa/Capa"
// import EstrategiaDocumentacao from "./pages/EstrategiaDocumentacao/EstrategiaDocumentacao" // Removido conforme solicitação
import LinhaTempo from "./pages/LinhaTempo/LinhaTempo"
import EstrategiaOnline from "./pages/EstrategiaOnline/EstrategiaOnline"
import VisaoGeral from "./pages/VisaoGeral/VisaoGeral"
import Alcance from "./pages/Alcance/Alcance"
import Visualizacoes from "./pages/Visualizacoes/Visualizacoes"
import TrafegoEngajamento from "./pages/TrafegoEngajamento/TrafegoEngajamento"
import VeiculacaoOffline from "./pages/VeiculacaoOffline/VeiculacaoOffine"
import CriativosTikTok from "./pages/CriativosTikTok/CriativosTikTok"
import CriativosMetaAds from "./pages/CriativosMetaAds/CriativosMetaAds"
import CriativosPinterest from "./pages/CriativosPinterest/CriativosPinterest"
import CriativosLinkedIn from "./pages/CriativosLinkedIn/CriativosLinkedin"
import Glossario from "./pages/Glossario/Glossario" // Nova importação para Glossario
import "./App.css"

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          {/* Redirecionar para Capa ao invés de Dashboard */}
          <Route path="/" element={<Navigate to="/capa" replace />} />
          <Route path="/capa" element={<Capa />} />
          {/* <Route path="/estrategia-documentacao" element={<EstrategiaDocumentacao />} /> */}{" "}
          {/* Removido conforme solicitação */}
          <Route path="/linha-tempo" element={<LinhaTempo />} />
          <Route path="/estrategia-online" element={<EstrategiaOnline />} />
          <Route path="/visao-geral" element={<VisaoGeral />} />
          <Route path="/alcance" element={<Alcance />} />
          <Route path="/visualizacoes" element={<Visualizacoes />} />
          <Route path="/trafego-engajamento" element={<TrafegoEngajamento />} />
          <Route path="/veiculacao-offline" element={<VeiculacaoOffline />} />
          <Route path="/criativos-meta-ads" element={<CriativosMetaAds />} />
          <Route path="/criativos-tiktok" element={<CriativosTikTok />} />
          <Route path="/criativos-pinterest" element={<CriativosPinterest />} />
          <Route path="/criativos-linkedin" element={<CriativosLinkedIn />} />
          <Route path="/glossario" element={<Glossario />} /> {/* Nova rota para Glossario */}
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
