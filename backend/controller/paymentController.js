module.exports.processPayment = async (method, amount) => {
    return {
        success: true,
        message: `Pago procesado con ${method}`,
        transactionId: "TX-" + Date.now()
    };
};
