import QRCode from "qrcode";

export async function generateQRDataURL(orderId: string): Promise<string> {
  return QRCode.toDataURL(orderId, {
    width: 200,
    margin: 2,
    color: {
      dark: "#FFFFFF",
      light: "#14161A",
    },
  });
}
