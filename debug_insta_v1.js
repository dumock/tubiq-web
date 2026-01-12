
const axios = require('axios');

const TIKHUB_KEY = 'YOUR_KEY_HERE'; // I need to get this from the app's config or user

async function checkInsta() {
    const username = 'pradaosantana';
    try {
        const res = await axios.get(`https://api.tikhub.io/api/v1/instagram/v1/fetch_user_info_by_username?username=${username}`, {
            headers: { 'Authorization': `Bearer ${process.argv[2]}` }
        });
        console.log(JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
}

checkInsta();
