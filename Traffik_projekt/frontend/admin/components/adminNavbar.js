export default {
    name: "navbar",
    template: `
    <nav>
        <ul>
            <li><router-link to="/admin">Startsida</router-link></li>
            <li><router-link to="/admin/subscriptions">Prenumerationer</router-link></li>
            <li><router-link to="/admin/pricing">Prissättning</router-link></li>
            <li><router-link to="/admin/account">Kontoinställningar</router-link></li>
            <li><router-link to="/admin/administration">Administration</router-link></li>
            <li><router-link to="/admin/login">Logga in</router-link></li>
        </ul>
    </nav>
    `
    
};