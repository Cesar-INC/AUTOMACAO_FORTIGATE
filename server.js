require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readLine = require('readline');
const IPFortigate = process.env.IP;
const portaFortigate = process.env.PORTA;
const chave = process.env.API_KEY;
const urlBase = `https://${IPFortigate}:${portaFortigate}`;
const vdom = process.env.VDOM
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
async function lerArquivoMACs() {
    const caminhoMACs = path.normalize(process.env.CAMINHO_MACS);
    const fileStream = fs.createReadStream(caminhoMACs);
    const rl = readLine.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const listaNomesMAC = [];

    for await (const linha of rl) {
        if (!linha.trim()) continue;
        const macFormatado = linha.replace(/-/g, ':').toUpperCase();
        const objetoCriado = await adicionarMACAddress(macFormatado);        
        if (objetoCriado) {
            listaNomesMAC.push({ name: objetoCriado.nomeMAC });
        }
    }

    if (listaNomesMAC.length > 0) {
        await atualizarOuCriarGrupo(listaNomesMAC);
    } else {
        console.log("Nenhum MAC válido para processar.");
    }
}

async function adicionarMACAddress(mac) {
    const url = `${urlBase}/api/v2/cmdb/firewall/address?vdom=${vdom}`;
    const nomeMAC = `MAC_ADDRESS_${mac}`;
    
    const resposta = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${chave}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: nomeMAC,
            type: 'mac',
            macaddr: mac
        })
    });
    const dados = await resposta.json();

    if (resposta.ok) {
        console.log(`Sucesso: ${nomeMAC} criado.`);
        return { nomeMAC: nomeMAC };
    } else if (dados.cli_error_code === -5) {
        console.log(`Aviso: ${nomeMAC} já existe no Fortigate.`);
        return { nomeMAC: nomeMAC };
    } else {
        console.error(`Erro ao criar ${mac}:`, dados.status);
        return null;
    }
}

async function atualizarOuCriarGrupo(membros) {
    const nomeGrupo = process.env.NOME_GRUPO;
    const urlBaseGrupo = `${urlBase}/api/v2/cmdb/firewall/addrgrp?vdom=${vdom}`;
    const respostaPost = await fetch(urlBaseGrupo, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${chave}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: nomeGrupo,
            member: membros
        })
    });

    const dadosPost = await respostaPost.json();
    if (respostaPost.status === 500 && dadosPost.cli_error_code === -5) {
        const respostaPut = await fetch(`${urlBaseGrupo}/${nomeGrupo}?vdom=${vdom}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${chave}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                member: membros
            })
        });

        if (respostaPut.ok) {
            console.log(`Grupo "${nomeGrupo}" atualizado com todos os membros.`);
        } else {
            console.error(`Erro ao atualizar membros do grupo.`);
        }
    } else if (respostaPost.ok) {
        console.log(`Grupo "${nomeGrupo}" criado com sucesso.`);
    } else {
        console.error("Erro inesperado no grupo:", dadosPost);
    }
}

lerArquivoMACs();