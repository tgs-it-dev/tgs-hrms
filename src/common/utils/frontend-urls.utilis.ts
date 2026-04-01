import { ConfigService } from "@nestjs/config";

interface FrontendUrls {
  url: string;
  linkedin_logo_url: string;
  x_logo_url: string;
  instagram_logo_url: string;
  companyLogoUrl: string;
}

export const getFrontendUrls = (configService: ConfigService): FrontendUrls => {
  const frontendUrl =
    configService.get<string>("FRONTEND_URL") || "http://localhost:5173";
  const linkedin_logo_url =
    configService.get<string>("LINKEDIN_LOGO_URL") ||
    `${frontendUrl}/public/linkedin.png`;
  const x_logo_url =
    configService.get<string>("X_LOGO_URL") || `${frontendUrl}/public/x.png`;
  const instagram_logo_url =
    configService.get<string>("INSTAGRAM_LOGO_URL") ||
    `${frontendUrl}/public/instagram.png`;
  const companyLogoUrl =
    configService.get<string>("COMPANY_LOGO_URL") ||
    `${frontendUrl}/public/logo.png`;
  return {
    url: frontendUrl,
    linkedin_logo_url,
    x_logo_url,
    instagram_logo_url,
    companyLogoUrl,
  };
};
