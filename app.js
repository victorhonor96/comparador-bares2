import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://zuupkhhvcrjzwkgwwtgz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1dXBraGh2Y3JqendrZ3d3dGd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDg3MTcsImV4cCI6MjA4NzUyNDcxN30.KJiStEORy4v9egIiPsbK5qy_KS4GPwYSypFEZ3494zw'
const supabase = createClient(supabaseUrl, supabaseKey)

// --- FUNÇÃO NORMALIZAR NOMES ---
function normalize(str) {
  return str
    .trim()
    .normalize("NFD")                 // separa acentos
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase();
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
      { onConflict: ["produto", "bar"] } // evita duplicados
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

// --- FUNÇÃO CALCULAR DISTÂNCIA ---
function calcularDistancia(lat1, lng1, lat2, lng2) {
  const R = 6371; // raio da Terra em km
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

// --- FUNÇÃO BUSCAR PREÇOS COM DISTÂNCIA ---
window.buscarPreco = async function () {
  const buscaSelect = document.getElementById("buscaProduto");
  const resultadoDiv = document.getElementById("resultado");

  if (!buscaSelect || !resultadoDiv) return;

  const produto = buscaSelect.value.trim();
  console.log("Produto buscado:", produto);

  if (!produto) {
    alert("Selecione um produto");
    return;
  }

  // Pega localização do usuário
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const userLat = pos.coords.latitude;
    const userLng = pos.coords.longitude;

    // Busca preços do produto
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

    // Busca localização dos bares
    const { data: distBares } = await supabase
      .from("dist_bares")
      .select("bar, lat, lng");

    // Junta preços com localização e calcula distância
    const baresComDistancia = bares.map(item => {
      const dist = distBares.find(d => normalize(d.bar) === normalize(item.bar));
      let distancia = null;
      let lat = null;
      let lng = null;

      if (dist && dist.lat != null && dist.lng != null) {
        lat = Number(dist.lat);
        lng = Number(dist.lng);
        distancia = calcularDistancia(userLat, userLng, lat, lng);
      }

      return {
        ...item,
        lat,
        lng,
        distancia
      };
    });

    // Verifica se algum bar não tem lat/lng
    const semLocalizacao = baresComDistancia.filter(b => b.distancia === null);
    if (semLocalizacao.length > 0) {
      console.warn("Alguns bares não possuem lat/lng definidos:", semLocalizacao.map(b => b.bar));
    }

    // Ordena por distância se disponível, senão por preço
    baresComDistancia.sort((a, b) => {
      if (a.distancia != null && b.distancia != null) return a.distancia - b.distancia;
      return a.preco - b.preco;
    });

    // Exibe resultados
    let html = "";
    baresComDistancia.forEach((item, index) => {
      const distText = item.distancia != null ? ` - ${item.distancia.toFixed(2)} km` : "";
      if (index === 0) html += `<p style="color: green; font-weight: bold;">🏆 ${item.bar} - R$ ${item.preco.toFixed(2)}${distText}</p>`;
      else html += `<p>${item.bar} - R$ ${item.preco.toFixed(2)}${distText}</p>`;
    });

    resultadoDiv.innerHTML = html;

  }, async (err) => {
    console.error("Erro ao pegar localização:", err);
    alert("Não foi possível obter sua localização. Mostrando preços sem distância.");

    // Se falhar, apenas mostrar preços sem distância
    const { data: bares, error } = await supabase
      .from("bares")
      .select("bar, produto, preco")
      .eq("produto", produto);

    let html = bares.map(item => `<p>${item.bar} - R$ ${item.preco.toFixed(2)}</p>`).join("");
    resultadoDiv.innerHTML = html || "Nenhum preço encontrado.";
  });
};
