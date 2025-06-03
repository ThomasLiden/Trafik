import adminLogin from "./adminLogin.js"; 
import adminHome from "./adminHome.js";
import adminPricing from "./adminPricing.js";
import administration from "./administration.js";
import adminAccount from "./adminAccount.js";
import adminSubscriptions from "./adminSubscriptions.js";



const routes = [
    { path: '/', redirect: '/admin/login' },
    { path: '/admin/login', component: adminLogin },
    //Skyddade vyer. 
    { path: '/admin', component: adminHome },
    { path: '/admin/subscriptions', component: adminSubscriptions },
    { path: '/admin/pricing', component: adminPricing },
    { path: '/admin/account', component: adminAccount},
    //endast för superadmin.
    { path: '/admin/administration', component: administration },      
];

const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes
});


 router.beforeEach((to, from, next) => {
    //Hämtar roll. 
    const userRole = localStorage.getItem("user_role");
    //console.log(userRole);
    
    //Om ej inloggad, redirect till inloggningsvyn.  
    if (!userRole && to.path !== '/admin/login') {
        return next('/admin/login');  
    }
    //Om inloggad reseller försöker gå till superadminsida, redirect till startsida. 
    if (to.path === '/admin/administration' && userRole !== 'superadmin') {
        return next('/admin');
    }
    //Annars tillåt navigering. 
    next(); 
});


export default router;