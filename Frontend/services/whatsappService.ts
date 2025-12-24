export const sendWhatsAppAlert = async (phoneNumber: string, message: string): Promise<boolean> => {
    // Basic validation
    if (!phoneNumber) {
        console.warn("Cannot send WhatsApp: No phone number provided");
        return false;
    }

    try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/send-alert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone_number: phoneNumber, 
                message: message
            })
        });

        if (!response.ok) {
            throw new Error("Backend failed to send alert");
        }
        
        const data = await response.json();
        console.log("WhatsApp Sent:", data);
        return true;

    } catch (error) {
        console.error("WhatsApp Error:", error);
        return false;
    }
};