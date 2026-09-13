/* Estado compartilhado entre os módulos. Um objeto só, mutado no lugar. */
export const S = {
  sb: null,
  authed: false,
  usuario: null,        // linha de public.usuarios (id, nome, email, perfil)
  carregando: true,
  leads: [],
  usuarios: [],
  motivos: [],
  interacoes: {},       // lead_id -> [interacoes]
  cfg: {}, categorias: [], adicionais: [], propostas: [],
  comercialOk: false,
  rota: { nome: "form", id: null },
  abertoEm: Date.now()
};
export const admin = () => !!(S.usuario && S.usuario.perfil === "admin");
export const rows  = () => S.leads;
export const lead  = (id) => S.leads.find(l => l.id === id) || null;
