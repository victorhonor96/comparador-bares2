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

// --- CALCULAR DISTÂNCIA ENTRE COORDENADAS ---
function calcularDistancia(lat1, lng1, lat2, lng2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --- BUSCAR PREÇOS (COM DISTÂNCIA) ---
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

  // 1️⃣ Busca preços no banco
  const { data: bares, error } = await supabase
    .from("bares")
    .select("bar, preco")
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

  // 2️⃣ Pega geolocalização do usuário
  if (!navigator.geolocation) {
    alert("Geolocalização não suportada pelo navegador.");
    return;
  }

  navigator.geolocation.getCurrentPosition(pos => {
    const userLat = pos.coords.latitude;
    const userLng = pos.coords.longitude;
    console.log("Sua localização:", userLat, userLng);

    // 3️⃣ Calcula distância de cada bar
    const resultadoComDist = bares.map(item => {
      const barData = window.distBaresCache.find(d => normalize(d.bar) === normalize(item.bar));
      let dist = null;
      if (barData && barData.lat != null && barData.lng != null) {
        dist = calcularDistancia(userLat, userLng, Number(barData.lat), Number(barData.lng));
      }
      return { ...item, dist };
    });

    // 4️⃣ Ordena por preço crescente
    resultadoComDist.sort((a, b) => a.preco - b.preco);

    // 5️⃣ Mostra na tela
    let html = "";
    resultadoComDist.forEach(item => {
      html += `<p>${item.bar} - R$ ${item.preco.toFixed(2)} - ${item.dist != null ? item.dist.toFixed(2) + " km" : "Distância não disponível"}</p>`;
    });
    resultadoDiv.innerHTML = html;

  }, err => {
    console.error("Erro ao pegar localização:", err);
  });
};

// --- MOSTRAR DISTÂNCIAS NO CONSOLE ---
window.mostrarDistancias = async function () {
  if (!window.distBaresCache || window.distBaresCache.length === 0) {
    await carregarDistBares();
  }

  navigator.geolocation.getCurrentPosition(pos => {
    const userLat = pos.coords.latitude;
    const userLng = pos.coords.longitude;
    console.log("Sua localização:", userLat, userLng);

    window.distBaresCache.forEach(b => {
      if (b.lat != null && b.lng != null) {
        const dist = calcularDistancia(userLat, userLng, Number(b.lat), Number(b.lng));
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
