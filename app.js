import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://zuupkhhvcrjzwkgwwtgz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1dXBraGh2Y3JqendrZ3d3dGd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDg3MTcsImV4cCI6MjA4NzUyNDcxN30.KJiStEORy4v9egIiPsbK5qy_KS4GPwYSypFEZ3494zw'
const supabase = createClient(supabaseUrl, supabaseKey)

// --- NORMALIZAR NOMES ---
function normalize(str) {
  return str
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// --- CACHE GLOBAL DE DIST_BARES ---
window.distBaresCache = [];

// --- CARREGAR DIST_BARES ---
async function carregarDistBares() {
  const { data, error } = await supabase
    .from("dist_bares")
    .select("bar, lat, lng");

  if (error) {
    console.error("Erro ao carregar dist_bares:", error);
    window.distBaresCache = [];
  } else {
    window.distBaresCache = data;
    console.log("Bares carregados no cache:", window.distBaresCache);

    // Mostrar especificamente Buteco Boi Brabo
    const buteco = window.distBaresCache.find(d => normalize(d.bar) === normalize("Buteco Boi Brabo"));
    if (buteco) {
      console.log("Buteco Boi Brabo - Lat:", buteco.lat, "Lng:", buteco.lng);
    } else {
      console.log("Buteco Boi Brabo não encontrado na tabela dist_bares");
    }
  }
}

// --- FUNÇÃO ADICIONAR OU ATUALIZAR PREÇO ---
window.adicionarPreco = async function () {
  const produtoSelect = document.getElementById("produto");
  const barInput = document.getElementById("bar");
  const precoInput = document.getElementById("preco");

  const produto = produtoSelect.value.trim();
  const bar = barInput.value.trim();
  const preco = parseFloat(precoInput.value);

  if (!produto || !bar || isNaN(preco)) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  const { error } = await supabase
    .from("bares")
    .upsert(
      [{ produto, bar, preco }],
      { onConflict: ["produto", "bar"] }
    );

  if (error) {
    console.log("Erro ao salvar preço:", error);
    alert("Erro ao salvar/atualizar preço!");
  } else {
    alert("Preço salvo/atualizado com sucesso!");
    precoInput.value = "";
    barInput.value = "";
    produtoSelect.value = "";
  }
};

// --- CALCULAR DISTÂNCIA ---
function calcularDistancia(lat1, lng1, lat2, lng2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) *
    Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLng/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// --- BUSCAR PREÇOS (SEM DISTÂNCIA) ---
window.buscarPreco = async function () {
  const buscaSelect = document.getElementById("buscaProduto");
  const resultadoDiv = document.getElementById("resultado");

  if (!buscaSelect || !resultadoDiv) return;

  const produto = buscaSelect.value.trim();
  if (!produto) {
    alert("Selecione um produto");
    return;
  }
  console.log("Produto buscado:", produto);

  const { data: bares, error } = await supabase
    .from("bares")
    .select("bar, produto, preco")
    .eq("produto", produto);

  if (error) {
    console.log("Erro ao buscar preços:", error);
    resultadoDiv.innerHTML = "Erro ao buscar preços.";
    return;
  }

  if (!bares || bares.length === 0) {
    resultadoDiv.innerHTML = "Nenhum preço encontrado.";
    return;
  }

  // Mostrar preços sem distância
  let html = "";
  bares.forEach((item, idx) => {
    html += idx === 0
      ? `<p style="color: green; font-weight: bold;">🏆 ${item.bar} - R$ ${item.preco.toFixed(2)}</p>`
      : `<p>${item.bar} - R$ ${item.preco.toFixed(2)}</p>`;
  });
  resultadoDiv.innerHTML = html;
};

// --- MOSTRAR DISTÂNCIA PARA TODOS OS BARES ---
window.mostrarDistancias = function () {
  if (!navigator.geolocation) {
    alert("Geolocalização não suportada pelo navegador.");
    return;
  }

  navigator.geolocation.getCurrentPosition(pos => {
    const userLat = pos.coords.latitude;
    const userLng = pos.coords.longitude;
    console.log("Sua localização:", userLat, userLng);

    window.distBaresCache.forEach(b => {
      if (b.lat != null && b.lng != null) {
        const lat = Number(b.lat);
        const lng = Number(b.lng);
        const dist = calcularDistancia(userLat, userLng, lat, lng);
        console.log(`${b.bar} - Distância: ${dist.toFixed(2)} km`);
      } else {
        console.log(`${b.bar} - Lat/Lng não definido`);
      }
    });

  }, err => {
    console.error("Erro ao pegar localização:", err);
  });
};

// --- CARREGA DIST_BARES AO INICIAR ---
carregarDistBares();
