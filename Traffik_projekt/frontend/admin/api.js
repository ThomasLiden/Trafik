//Hämtar token från inloggad användare. 
//(Så vi slipper hämta token i varje komponent och skicka med headers, authorization. //
// Importera denna fil istället till komponenten där vi behöver göra api-anrop.

//En återanvändbar funkiton för att göra API-anrop med automatiskt hantering av access_token. 
export async function apiFetch(url, options = {}) {
  //Hämta access_token från local storage. 
  const token = localStorage.getItem("access_token");
  
  //Förbered headers - inkludera standard Content-type och eventuella egna headers. 
  const headers = {
    "Content-Type": "application/json",
    ...options.headers
  };
  
  //Om token finns, lägg till Authorization-headern.
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  //Gör fetch-anropet med angiven url, inställningar och headers.
  const res = await fetch(url, {
    ...options,
    headers
  });
  
  //Försök tolka svaret som JSON. Om det är tomt, returnera null.
  const data = await res.json().catch(() => null); 

  if (!res.ok) throw new Error(data?.error || "Fel vid API-anrop");

  //Returnera json-data.
  return data;
}