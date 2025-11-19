import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Layout from "./components/Layout/Layout"
import { DataProvider } from "./contexts/DataContext"
import Capa from "./pages/Capa/Capa"
// import EstrategiaDocumentacao from "./pages/EstrategiaDocumentacao/EstrategiaDocumentacao" // Removido conforme solicitação
import LinhaTempo from "./pages/LinhaTempo/LinhaTempo"
// import EstrategiaOnline from "./pages/EstrategiaOnline/EstrategiaOnline" // Removido conforme solicitação
import VisaoGeral from "./pages/VisaoGeral/VisaoGeral"
import Alcance from "./pages/Alcance/Alcance"
import Visualizacoes from "./pages/Visualizacoes/Visualizacoes"
import TrafegoEngajamento from "./pages/TrafegoEngajamento/TrafegoEngajamento"
import Producao from "./pages/Producao/Producao"
import VeiculacaoOffline from "./pages/VeiculacaoOffline/VeiculacaoOffine"
import CriativosTikTok from "./pages/CriativosTikTok/CriativosTikTok"
import CriativosMetaAds from "./pages/CriativosMetaAds/CriativosMetaAds"
import CriativosGoogleAds from "./pages/CriativosGoogleAds/CriativosGoogleAds"
import CriativosLinkedIn from "./pages/CriativosLinkedIn/CriativosLinkedin"
import CriativosKwai from "./pages/CriativosKwai/CriativosKwai"
import Glossario from "./pages/Glossario/Glossario" // Nova importação para Glossario
import Portais from "./pages/Portais/Portais" // Nova importação para Portais
import CampanhasAtivas from "./pages/CampanhasAtivas/CampanhasAtivas" // Nova importação para Campanhas Ativas
import "./App.css"

function App() {
  return (
    <Router>
      <DataProvider>
        <Layout>
          <Routes>
            {/* Redirecionar para Capa ao invés de Dashboard */}
            <Route path="/" element={<Navigate to="/capa" replace />} />
            <Route path="/capa" element={<Capa />} />
            {/* <Route path="/estrategia-documentacao" element={<EstrategiaDocumentacao />} /> */}{" "}
            {/* Removido conforme solicitação */}
            <Route path="/linha-tempo" element={<LinhaTempo />} />
            {/* <Route path="/estrategia-online" element={<EstrategiaOnline />} /> */}{" "}
            {/* Removido conforme solicitação */}
            <Route path="/visao-geral" element={<VisaoGeral />} />
            <Route path="/alcance" element={<Alcance />} />
            <Route path="/visualizacoes" element={<Visualizacoes />} />
            <Route path="/trafego-engajamento" element={<TrafegoEngajamento />} />
            <Route path="/producao" element={<Producao />} />
            <Route path="/veiculacao-offline" element={<VeiculacaoOffline />} />
            <Route path="/criativos-meta-ads" element={<CriativosMetaAds />} />
            <Route path="/criativos-tiktok" element={<CriativosTikTok />} />
            <Route path="/criativos-google-ads" element={<CriativosGoogleAds />} />
            <Route path="/criativos-linkedin" element={<CriativosLinkedIn />} />
            <Route path="/criativos-kwai" element={<CriativosKwai />} />
            <Route path="/portais" element={<Portais />} /> {/* Nova rota para Portais */}
            <Route path="/campanhas-ativas" element={<CampanhasAtivas />} /> {/* Nova rota para Campanhas Ativas */}
            <Route path="/glossario" element={<Glossario />} /> {/* Nova rota para Glossario */}
          </Routes>
        </Layout>
      </DataProvider>
    </Router>
  )
}

export default App
