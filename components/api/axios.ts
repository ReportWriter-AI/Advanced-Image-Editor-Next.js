import assert from 'assert';
import Axios from 'axios';

assert(
	process.env.NEXT_PUBLIC_API_BASE_URL,
	'env variable not set: NEXT_PUBLIC_API_BASE_URL (did you forget to create a .env file from .env.template?)'
);

export const axios = Axios.create({
	baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
	timeout: 100000,
	withCredentials: true,
	headers: {
		'Content-Type': 'application/json',
	},
});


axios.interceptors.response.use(
	(response) => response,
	(error) => {
		if (
			(error.response && error.response.status === 401) ||
			(error.response && error.response.status === 403) ||
			(error.response && error.response.data?.message === 'Not Authorized')
		) {
			if (error.response && error.response.status === 401) {
				if (typeof window !== 'undefined') {
					window.location.reload();
				}
			}
		}
		return Promise.reject(error);
	}
);